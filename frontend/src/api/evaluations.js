import axios from 'axios';

const API_BASE = 'http://localhost:5000/api/evaluations';

export const runEvaluation = (promptId, targetModel) =>
  axios.post(`${API_BASE}/run`, { promptId, targetModel }).then(res => res.data);

export const getEvaluationStatus = (id) =>
  axios.get(`${API_BASE}/${id}`).then(res => res.data);

export const getResults = () =>
  axios.get(`${API_BASE}/results`).then(res => res.data);
