import axios from "axios";
import { API_HOST_PREFIX } from "./serviceHelpers";

const endpoint = `${API_HOST_PREFIX}/api/admin/inventory-cleanup`;
const unwrap = (response) => response.data;

const search = ({ query = "", olderThanDays = 90, pageIndex = 0, pageSize = 20 } = {}) =>
  axios.get(endpoint, { params: { query, olderThanDays, pageIndex, pageSize }, withCredentials: true }).then(unwrap);

const preview = (id) =>
  axios.get(`${endpoint}/${id}/preview`, { withCredentials: true }).then(unwrap);

const deletePart = (id, confirmPartId) =>
  axios.delete(`${endpoint}/${id}`, { data: { confirmPartId }, withCredentials: true }).then(unwrap);

const retryPhotoCleanup = () =>
  axios.post(`${endpoint}/photos/retry`, {}, { withCredentials: true }).then(unwrap);

const inventoryCleanupService = { search, preview, deletePart, retryPhotoCleanup };
export default inventoryCleanupService;
