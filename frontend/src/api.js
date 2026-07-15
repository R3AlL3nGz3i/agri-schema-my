import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  timeout: 30000,
});

export const getCrops    = ()           => api.get("/crops");
export const getDiseases = (crop)       => api.get(`/crops/${crop}/diseases`);
export const getDisease  = (crop, name) => api.get(`/crops/${crop}/diseases/${name}`);
export const getStats    = ()           => api.get("/stats");
export const getAggregates = ()         => api.get("/aggregates");
export const getReviews    = ()         => api.get("/reviews");
export const queryDisease = (payload)   => api.post("/query", payload);
export const diagnoseImage = (formData) =>
  api.post("/diagnose", formData, { headers: { "Content-Type": "multipart/form-data" } });

export default api;
