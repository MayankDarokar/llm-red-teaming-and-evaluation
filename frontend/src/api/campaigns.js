import axios from 'axios';

const API_BASE = 'http://localhost:5000/api/campaigns';

export const createCampaign = (campaignData) =>
  axios.post(API_BASE, campaignData).then(res => res.data);

export const getCampaigns = () =>
  axios.get(API_BASE).then(res => res.data);

export const getCampaignById = (id) =>
  axios.get(`${API_BASE}/${id}`).then(res => res.data);

export const startCampaign = (id) =>
  axios.post(`${API_BASE}/${id}/start`).then(res => res.data);

export const stopCampaign = (id) =>
  axios.post(`${API_BASE}/${id}/stop`).then(res => res.data);

export const getCampaignStatus = (id) =>
  axios.get(`${API_BASE}/${id}/status`).then(res => res.data);

export const getCampaignResults = (id) =>
  axios.get(`${API_BASE}/${id}/results`).then(res => res.data);

export const getCampaignMetrics = (id) =>
  axios.get(`${API_BASE}/${id}/metrics`).then(res => res.data);
