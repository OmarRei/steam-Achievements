from fastapi import FastAPI, APIRouter, HTTPException, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
import aiohttp
import json


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Steam API configuration
STEAM_API_KEY = os.environ['STEAM_API_KEY']
STEAM_BASE_URL = "https://api.steampowered.com"

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class GameSearchResult(BaseModel):
    appid: int
    name: str

class Achievement(BaseModel):
    name: str
    displayName: str
    description: str
    icon: str
    icongray: str
    hidden: int
    percent: Optional[float] = None

class GameAchievements(BaseModel):
    appid: int
    gameName: str
    achievements: List[Achievement]


# Steam API Helper Functions
async def search_steam_games(query: str) -> List[GameSearchResult]:
    """Search for Steam games using the Steam Store API"""
    try:
        async with aiohttp.ClientSession() as session:
            # Use Steam Store API for game search (doesn't require API key)
            url = f"https://store.steampowered.com/api/storesearch/?term={query}&l=english&cc=US"
            async with session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    games = []
                    for item in data.get('items', [])[:20]:  # Limit to 20 results
                        if item.get('type') == 'app':
                            games.append(GameSearchResult(
                                appid=item['id'],
                                name=item['name']
                            ))
                    return games
                else:
                    return []
    except Exception as e:
        logger.error(f"Error searching Steam games: {e}")
        return []


async def get_game_achievements(appid: int) -> Optional[GameAchievements]:
    """Get achievements for a specific Steam game"""
    try:
        async with aiohttp.ClientSession() as session:
            # Get game schema (achievements list)
            schema_url = f"{STEAM_BASE_URL}/ISteamUserStats/GetSchemaForGame/v0002/"
            schema_params = {
                'key': STEAM_API_KEY,
                'appid': appid,
                'l': 'english'
            }
            
            async with session.get(schema_url, params=schema_params) as response:
                if response.status != 200:
                    return None
                    
                schema_data = await response.json()
                game_data = schema_data.get('game')
                
                if not game_data:
                    return None
                    
                game_name = game_data.get('gameName', f'Game {appid}')
                available_stats = game_data.get('availableGameStats', {})
                achievements_data = available_stats.get('achievements', [])
                
                if not achievements_data:
                    return GameAchievements(
                        appid=appid,
                        gameName=game_name,
                        achievements=[]
                    )
                
                # Get achievement percentages
                percent_url = f"{STEAM_BASE_URL}/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/"
                percent_params = {'gameid': appid}
                
                achievement_percentages = {}
                try:
                    async with session.get(percent_url, params=percent_params) as percent_response:
                        if percent_response.status == 200:
                            percent_data = await percent_response.json()
                            for ach in percent_data.get('achievementpercentages', {}).get('achievements', []):
                                achievement_percentages[ach['name']] = ach['percent']
                except:
                    pass  # Continue without percentages if this fails
                
                # Parse achievements
                achievements = []
                for ach in achievements_data:
                    achievement = Achievement(
                        name=ach.get('name', ''),
                        displayName=ach.get('displayName', ''),
                        description=ach.get('description', ''),
                        icon=ach.get('icon', ''),
                        icongray=ach.get('icongray', ''),
                        hidden=ach.get('hidden', 0),
                        percent=achievement_percentages.get(ach.get('name'))
                    )
                    achievements.append(achievement)
                
                return GameAchievements(
                    appid=appid,
                    gameName=game_name,
                    achievements=achievements
                )
                
    except Exception as e:
        logger.error(f"Error getting achievements for appid {appid}: {e}")
        return None


# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Steam Achievements API"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

@api_router.get("/games/search")
async def search_games(q: str):
    """Search for Steam games by name"""
    if not q or len(q.strip()) < 2:
        raise HTTPException(status_code=400, detail="Query must be at least 2 characters")
    
    # Check if query is numeric (App ID search)
    if q.strip().isdigit():
        appid = int(q.strip())
        achievements = await get_game_achievements(appid)
        if achievements:
            return [{"appid": appid, "name": achievements.gameName}]
        else:
            raise HTTPException(status_code=404, detail="Game not found")
    
    # Text search
    games = await search_steam_games(q.strip())
    return [{"appid": game.appid, "name": game.name} for game in games]

@api_router.get("/games/{appid}/achievements")
async def get_achievements(appid: int):
    """Get achievements for a specific game"""
    # Check cache first
    cached = await db.achievements.find_one({"appid": appid})
    if cached:
        # Remove MongoDB _id field
        cached.pop('_id', None)
        return cached
    
    # Fetch from Steam API
    achievements_data = await get_game_achievements(appid)
    if not achievements_data:
        raise HTTPException(status_code=404, detail="Game not found or has no achievements")
    
    # Cache the result
    cache_data = achievements_data.dict()
    cache_data['cached_at'] = datetime.utcnow()
    await db.achievements.insert_one(cache_data)
    
    return achievements_data.dict()

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()