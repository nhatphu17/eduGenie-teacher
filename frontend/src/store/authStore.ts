import { create } from 'zustand';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  subscriptionPlan?: {
    name: string;
    dailyQuota: number;
    monthlyQuota: number;
  };
}

interface AuthState {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: (() => {
    try {
      const stored = localStorage.getItem('auth-storage');
      return stored ? JSON.parse(stored).user : null;
    } catch {
      return null;
    }
  })(),
  token: (() => {
    try {
      const stored = localStorage.getItem('auth-storage');
      const token = stored ? JSON.parse(stored).token : null;
      if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
      return token;
    } catch {
      return null;
    }
  })(),
  login: async (email: string, password: string) => {
    const response = await axios.post(`${API_URL}/auth/login`, { email, password });
    const state = { user: response.data.user, token: response.data.accessToken };
    set(state);
    localStorage.setItem('auth-storage', JSON.stringify(state));
    axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.accessToken}`;
  },
  register: async (name: string, email: string, password: string) => {
    const response = await axios.post(`${API_URL}/auth/register`, { name, email, password });
    const state = { user: response.data.user, token: response.data.accessToken };
    set(state);
    localStorage.setItem('auth-storage', JSON.stringify(state));
    axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.accessToken}`;
  },
  logout: () => {
    set({ user: null, token: null });
    localStorage.removeItem('auth-storage');
    delete axios.defaults.headers.common['Authorization'];
  },
  setUser: (user: User) => {
    set({ user });
    const stored = localStorage.getItem('auth-storage');
    if (stored) {
      const state = JSON.parse(stored);
      state.user = user;
      localStorage.setItem('auth-storage', JSON.stringify(state));
    }
  },
}));


