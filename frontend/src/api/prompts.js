import axios from 'axios';

const API_BASE = 'http://localhost:5000/api/prompts';

export const getPrompts = (params) => axios.get(API_BASE, { params }).then(res => res.data);
export const getPrompt = (id) => axios.get(`${API_BASE}/${id}`).then(res => res.data);
export const createPrompt = (data) => axios.post(API_BASE, data).then(res => res.data);
export const updatePrompt = (id, data) => axios.put(`${API_BASE}/${id}`, data).then(res => res.data);
export const deletePrompt = (id) => axios.delete(`${API_BASE}/${id}`).then(res => res.data);
