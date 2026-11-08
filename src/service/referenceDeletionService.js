import axios from "axios";
import { API_HOST_PREFIX, onGlobalSuccess, onGlobalError } from "./serviceHelpers";

const request = (kind, target, preview) => {
  const manufacturer = kind === "manufacturer";
  const path = manufacturer ? "makes/manufacturer" : `${kind}/${target}`;
  return axios({
    method: preview ? "GET" : "DELETE",
    url: `${API_HOST_PREFIX}/api/${path}${preview ? "/delete-check" : ""}`,
    params: manufacturer ? { company: target } : undefined,
    withCredentials: true,
  }).then(onGlobalSuccess).catch(onGlobalError);
};

const referenceDeletionService = {
  preview: (kind, target) => request(kind, target, true),
  remove: (kind, target) => request(kind, target, false),
};
export default referenceDeletionService;
