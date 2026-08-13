import axios from 'axios';

const API_BASE = 'http://localhost:5000/api/stats';

export const getStats = () => axios.get(API_BASE).then(res => res.data);
