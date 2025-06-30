import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [achievementsLoading, setAchievementsLoading] = useState(false);
  const [error, setError] = useState('');

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchGames();
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const searchGames = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${BACKEND_URL}/api/games/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error searching games');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const selectGame = async (game) => {
    setSelectedGame(game);
    setAchievementsLoading(true);
    setError('');
    setAchievements([]);
    
    try {
      const response = await axios.get(`${BACKEND_URL}/api/games/${game.appid}/achievements`);
      setAchievements(response.data.achievements || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error loading achievements');
    } finally {
      setAchievementsLoading(false);
    }
  };

  const openAchievementGuide = (achievement, gameName) => {
    const query = `how to get "${achievement.displayName}" achievement in "${gameName}"`;
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    window.open(googleUrl, '_blank');
  };

  const clearSelection = () => {
    setSelectedGame(null);
    setAchievements([]);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 shadow-2xl">
        <div className="container mx-auto px-6 py-8">
          <h1 className="text-4xl font-bold text-white text-center mb-2">
            🎮 Steam Achievements Explorer
          </h1>
          <p className="text-blue-100 text-center text-lg">
            Discover game achievements and learn how to unlock them
          </p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Search Section */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 shadow-2xl border border-white/20">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by game name or Steam App ID..."
                className="w-full px-6 py-4 text-lg bg-white/20 backdrop-blur border border-white/30 rounded-xl text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-300"
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                <svg className="w-6 h-6 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="max-w-2xl mx-auto mb-6">
            <div className="bg-red-500/20 backdrop-blur border border-red-500/50 rounded-xl p-4">
              <p className="text-red-200 text-center">{error}</p>
            </div>
          </div>
        )}

        {/* Search Results */}
        {!selectedGame && searchResults.length > 0 && (
          <div className="max-w-4xl mx-auto mb-8">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Search Results</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {searchResults.map((game) => (
                <div
                  key={game.appid}
                  onClick={() => selectGame(game)}
                  className="bg-white/10 backdrop-blur-lg rounded-xl p-6 cursor-pointer hover:bg-white/20 transition-all duration-300 border border-white/20 hover:border-white/40 hover:scale-105 hover:shadow-2xl"
                >
                  <h3 className="text-white font-semibold text-lg mb-2 line-clamp-2">{game.name}</h3>
                  <p className="text-blue-200 text-sm">App ID: {game.appid}</p>
                  <div className="mt-4 flex items-center text-blue-300">
                    <span className="text-sm">View Achievements</span>
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading States */}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-flex items-center px-6 py-3 bg-white/10 backdrop-blur rounded-xl border border-white/20">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
              <span className="text-white">Searching games...</span>
            </div>
          </div>
        )}

        {achievementsLoading && (
          <div className="text-center py-8">
            <div className="inline-flex items-center px-6 py-3 bg-white/10 backdrop-blur rounded-xl border border-white/20">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
              <span className="text-white">Loading achievements...</span>
            </div>
          </div>
        )}

        {/* Achievements Display */}
        {selectedGame && !achievementsLoading && (
          <div className="max-w-6xl mx-auto">
            {/* Game Header */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-8 shadow-2xl border border-white/20">
              <div className="flex flex-col md:flex-row md:items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">{selectedGame.name}</h2>
                  <p className="text-blue-200">App ID: {selectedGame.appid}</p>
                  <p className="text-green-300 mt-2">{achievements.length} Achievements Found</p>
                </div>
                <button
                  onClick={clearSelection}
                  className="mt-4 md:mt-0 px-6 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-xl text-red-200 hover:text-white transition-all duration-300"
                >
                  ← Back to Search
                </button>
              </div>
            </div>

            {/* Achievements Grid */}
            {achievements.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {achievements.map((achievement, index) => (
                  <div
                    key={index}
                    onClick={() => openAchievementGuide(achievement, selectedGame.name)}
                    className="bg-white/10 backdrop-blur-lg rounded-xl p-6 cursor-pointer hover:bg-white/20 transition-all duration-300 border border-white/20 hover:border-white/40 hover:scale-105 hover:shadow-2xl group"
                  >
                    <div className="flex items-start space-x-4">
                      {achievement.icon && (
                        <img
                          src={achievement.icon}
                          alt={achievement.displayName}
                          className="w-16 h-16 rounded-lg flex-shrink-0 group-hover:scale-110 transition-transform duration-300"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-lg mb-2 line-clamp-2">
                          {achievement.displayName || achievement.name}
                        </h3>
                        <p className="text-gray-300 text-sm mb-3 line-clamp-3">
                          {achievement.description || 'No description available'}
                        </p>
                        
                        {achievement.percent !== null && achievement.percent !== undefined && (
                          <div className="mb-3">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs text-blue-200">Completion Rate</span>
                              <span className="text-xs text-white font-medium">{achievement.percent.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-white/20 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-blue-400 to-purple-500 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(achievement.percent, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center text-blue-300 group-hover:text-white transition-colors duration-300">
                          <span className="text-sm font-medium">Get Achievement Guide</span>
                          <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
                  <div className="text-6xl mb-4">🏆</div>
                  <h3 className="text-2xl font-bold text-white mb-2">No Achievements Found</h3>
                  <p className="text-gray-300">This game doesn't have achievements or they're not available via the Steam API.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* No Results */}
        {!selectedGame && !loading && searchQuery.length >= 2 && searchResults.length === 0 && !error && (
          <div className="text-center py-12">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 max-w-md mx-auto">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-2xl font-bold text-white mb-2">No Games Found</h3>
              <p className="text-gray-300">Try searching with a different game name or Steam App ID.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;