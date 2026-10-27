import axios from "axios";
import {
  onGlobalSuccess,
  onGlobalError,
  API_HOST_PREFIX,
} from "./serviceHelpers";

const homeEndpoint = `${API_HOST_PREFIX}/api/home`;
const partsEndpoint = `${API_HOST_PREFIX}/api/parts`;
const partImageUrl = API_HOST_PREFIX;

const deletePart = (id) => {
  const config = {
    method: "DELETE",
    url: `${homeEndpoint}/${id}`,
    withCredentials: true,
    crossdomain: true,
    headers: { "Content-Type": "application/json" },
  };
  return axios(config).then(onGlobalSuccess).catch(onGlobalError);
};

const addPart = (payload) => {
  const config = {
    method: "POST",
    url: `${homeEndpoint}/add-new`,
    data: payload,
    withCredentials: true,
    crossdomain: true,
  };
  return axios(config).then(onGlobalSuccess).catch(onGlobalError);
};

const patchPart = (payload, id) => {
  const config = {
    method: "PATCH",
    url: `${homeEndpoint}/${id}`,
    data: payload,
    withCredentials: true,
    crossdomain: true,
  };
  return axios(config).then(onGlobalSuccess).catch(onGlobalError);
};


const getShippingReassignmentPlan = (id, targetShippingPolicyId) => {
  const config = {
    method: "GET",
    url: `${homeEndpoint}/${id}/shopify/shipping-reassignment-plan`,
    params: { targetShippingPolicyId },
    withCredentials: true,
    crossdomain: true,
  };
  return axios(config).then(onGlobalSuccess).catch(onGlobalError);
};

// Reassignment is guarded server-side, entirely independently of legacy PATCH.
// The normal edit UI only calls this after a read-only plan and confirmation.
const reassignMarketShipping = (id, request) => {
  const config = {
    method: "POST",
    url: `${homeEndpoint}/${id}/shopify/shipping-reassign`,
    data: request,
    withCredentials: true,
    crossdomain: true,
    headers: { "Content-Type": "application/json" },
  };
  return axios(config).then(onGlobalSuccess).catch(onGlobalError);
};

const getPartById = (id) => {
  const config = {
    method: "GET",
    url: `${homeEndpoint}/admin/${id}`,
    withCredentials: true,
    crossdomain: true,
    headers: { "Content-Type": "application/json" },
  };
  return axios(config).then(onGlobalSuccess).catch(onGlobalError);
};

const getPartByIdCustomer = (id) => {
  const config = {
    method: "GET",
    url: `${homeEndpoint}/part/${id}`,
    withCredentials: true,
    crossdomain: true,
    headers: { "Content-Type": "application/json" },
  };
  return axios(config).then(onGlobalSuccess).catch(onGlobalError);
};

const getPartImagesByPartId = (id) => {
  const config = {
    method: "GET",
    url: `${homeEndpoint}/${id}/images`,
    withCredentials: true,
    crossdomain: true,
    headers: { "Content-Type": "application/json" },
  };
  return axios(config).then(onGlobalSuccess).catch(onGlobalError);
};

// Upload 1+ gallery images for a part.
// FormData keys must match the API request model:
// - Images: one or more File entries
// - SortStart: integer (optional)
const addPartImages = (id, files = []) => {
  const fd = new FormData();
  (files || []).forEach((f) => fd.append("Images", f));

  const config = {
    method: "POST",
    url: `${homeEndpoint}/${id}/images`,
    data: fd,
    withCredentials: true,
    crossdomain: true,
  };

  return axios(config).then(onGlobalSuccess).catch(onGlobalError);
};

const getAllAvailablePartsCustomer = (pageIndex, pageSize) => {
  const config = {
    method: "GET",
    url: `${partsEndpoint}/customer/paginate?pageIndex=${pageIndex}&pageSize=${pageSize}`,
    withCredentials: true,
    crossdomain: true,
    headers: { "Content-Type": "application/json" },
  };
  return axios(config).then(onGlobalSuccess).catch(onGlobalError);
};

const getAllParts = (pageIndex, pageSize) => {
  const config = {
    method: "GET",
    url: `${homeEndpoint}/stock?pageIndex=${pageIndex}&pageSize=${pageSize}`,
    withCredentials: true,
    crossdomain: true,
    headers: { "Content-Type": "application/json" },
  };
  return axios(config).then(onGlobalSuccess).catch(onGlobalError);
};

const getByCategoryCustomer = (pageIndex, pageSize, categoryId) => {
  const config = {
    method: "GET",
    url: `${homeEndpoint}/category/${categoryId}?pageIndex=${pageIndex}&pageSize=${pageSize}`,
    withCredentials: true,
    crossdomain: true,
    headers: { "Content-Type": "application/json" },
  };
  return axios(config).then(onGlobalSuccess).catch(onGlobalError);
};

const getByModelCustomer = (pageIndex, pageSize, modelId) => {
  const config = {
    method: "GET",
    url: `${homeEndpoint}/model/${modelId}?pageIndex=${pageIndex}&pageSize=${pageSize}`,
    withCredentials: true,
    crossdomain: true,
    headers: { "Content-Type": "application/json" },
  };
  return axios(config).then(onGlobalSuccess).catch(onGlobalError);
};

const searchPart = (params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== null && item !== undefined && item !== "") {
          searchParams.append(key, String(item));
        }
      });
      return;
    }

    searchParams.append(key, String(value));
  });

  const query = searchParams.toString();
  const config = {
    method: "GET",
    url: `${homeEndpoint}/search${query ? `?${query}` : ""}`,
    withCredentials: true,
    crossdomain: true,
  };

  return axios(config).then(onGlobalSuccess).catch(onGlobalError);
};

const customerSearch = (params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== null && item !== undefined && item !== "") {
          searchParams.append(key, String(item));
        }
      });
      return;
    }

    searchParams.append(key, String(value));
  });

  const query = searchParams.toString();
  const config = {
    method: "GET",
    url: `${homeEndpoint}/search/customer${query ? `?${query}` : ""}`,
    withCredentials: true,
    crossdomain: true,
  };
  return axios(config).then(onGlobalSuccess).catch(onGlobalError);
};

const publishShopifyProduct = (partId) => {
  const config = {
    method: "POST",
    url: `${homeEndpoint}/${partId}/shopify/publish`,
    withCredentials: true,
    crossdomain: true,
    headers: { "Content-Type": "application/json" },
  };

  return axios(config);
};

const syncShopifyProduct = (partId) => {
  const config = {
    method: "POST",
    url: `${homeEndpoint}/${partId}/shopify/sync`,
    withCredentials: true,
    crossdomain: true,
    headers: { "Content-Type": "application/json" },
  };

  return axios(config);
};

const unpublishShopifyProduct = (partId) => {
  const config = {
    method: "POST",
    url: `${homeEndpoint}/${partId}/shopify/unpublish`,
    withCredentials: true,
    crossdomain: true,
    headers: { "Content-Type": "application/json" },
  };

  return axios(config);
};

const partsService = {
  deletePart,
  addPart,
  patchPart,
  getShippingReassignmentPlan,
  reassignMarketShipping,
  getPartById,
  getAllAvailablePartsCustomer,
  getAllParts,
  searchPart,
  customerSearch,
  getPartByIdCustomer,
  getPartImagesByPartId,
  addPartImages,
  getByCategoryCustomer,
  getByModelCustomer,
  publishShopifyProduct,
  syncShopifyProduct,
  unpublishShopifyProduct,
  partImageUrl,
};

export default partsService;
