import axios from 'axios';

const API_BASE = 'http://localhost:5000/api/providers';

export const getProviders = async () => {
  const res = await axios.get(API_BASE);
  return res.data;
};

export const getProviderModels = async (provider) => {
  const res = await axios.get(`${API_BASE}/${provider}/models`);
  return res.data;
};

export const getProviderStatus = async (provider) => {
  const res = await axios.get(`${API_BASE}/${provider}/status`);
  return res.data;
};
