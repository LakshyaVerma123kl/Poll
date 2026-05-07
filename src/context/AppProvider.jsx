import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AppContext = createContext();

export const useApp = () => useContext(AppContext);

// Automatically adapts to Split Deployment (Vercel + Render), Single Service (Render), or Local Dev
const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

export const AppProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('currentUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [users, setUsers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [votes, setVotes] = useState({}); // { matchId: 'team' }

  const fetchData = useCallback(async () => {
    try {
      // Fetch Leaderboard
      const usersRes = await axios.get(`${API_BASE}/users`);
      setUsers(usersRes.data);

      // Keep currentUser points synced from server
      if (currentUser) {
        const freshUser = usersRes.data.find(u => u.id === currentUser.id);
        if (freshUser && freshUser.points !== currentUser.points) {
          const updated = { ...currentUser, points: freshUser.points };
          setCurrentUser(updated);
          localStorage.setItem('currentUser', JSON.stringify(updated));
        }
      }

      // Fetch Matches & Votes
      const url = currentUser ? `${API_BASE}/matches?userId=${currentUser.id}` : `${API_BASE}/matches`;
      const matchesRes = await axios.get(url);
      setMatches(matchesRes.data.matches);
      if (matchesRes.data.votes) {
        const formattedVotes = {};
        for (const [mId, team] of Object.entries(matchesRes.data.votes)) {
          formattedVotes[mId] = { [currentUser.id]: team };
        }
        setVotes(formattedVotes);
      }
    } catch (err) {
      console.error("Failed to fetch data", err);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [fetchData]);

  const login = async (name) => {
    try {
      const res = await axios.post(`${API_BASE}/login`, { name });
      setCurrentUser(res.data);
      localStorage.setItem('currentUser', JSON.stringify(res.data));
    } catch (err) {
      alert("Login failed");
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    setVotes({});
  };

  const castVote = async (matchId, team) => {
    if (!currentUser) return;
    try {
      await axios.post(`${API_BASE}/vote`, {
        userId: currentUser.id,
        matchId,
        team
      });
      // Optimistically update UI
      setVotes(prev => ({
        ...prev,
        [matchId]: {
          ...prev[matchId],
          [currentUser.id]: team
        }
      }));
    } catch (err) {
      alert(err.response?.data?.error || "Failed to vote");
    }
  };

  const simulateMatchEnd = async (matchId, winnerTeam) => {
    try {
      await axios.post(`${API_BASE}/admin/simulate`, { matchId, winner: winnerTeam });
      fetchData(); // Refresh immediately
    } catch (err) {
      alert("Simulation failed");
    }
  };

  const value = {
    currentUser,
    users,
    matches,
    votes,
    login,
    logout,
    castVote,
    simulateMatchEnd,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};
