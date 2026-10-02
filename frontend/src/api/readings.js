import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const fetchReadings = async () => {
  const response = await client.get('/readings/');
  return response.data;
};

export const uploadReadingsBatch = async (batchPayload) => {
  const response = await client.post('/readings/', batchPayload);
  return response.data;
};

export const clearAllReadings = async () => {
  const response = await client.delete('/readings/');
  return response.data;
};
