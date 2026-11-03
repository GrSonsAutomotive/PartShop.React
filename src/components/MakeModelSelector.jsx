import React, { useEffect, useRef, useState } from "react";
import makeService from "../service/makeService";
import modelService from "../service/modelService";

function MakeModelSelector({
  onSelectionChange,
  initialMakeId = "",
  initialModelId = "",
  idPrefix = "make-model",
  disabled = false,
}) {
  const [makes, setMakes] = useState([]);
  const [models, setModels] = useState([]);
  const [selectedCompanyMakeId, setSelectedCompanyMakeId] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [isLoadingMakes, setIsLoadingMakes] = useState(true);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [loadError, setLoadError] = useState("");

  // Prevent an older request from replacing the results of a newer selection.
  const modelRequestIdRef = useRef(0);
  // Changing a company clears the parent's old make/model pair while the user
  // chooses a new model. Do not mistake that temporary blank for a form reset.
  const awaitingModelSelectionRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    setIsLoadingMakes(true);
    setLoadError("");

    makeService
      .getAllCompanies()
      .then((res) => {
        if (!isMounted) return;
        setMakes(Array.isArray(res?.item) ? res.item : []);
      })
      .catch((error) => {
        if (!isMounted) return;
        console.error("Failed to load makes", error);
        setMakes([]);
        setLoadError("Unable to load makes.");
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingMakes(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const normalizedInitialMakeId = String(initialMakeId || "");
    const normalizedInitialModelId = String(initialModelId || "");

    if (!normalizedInitialMakeId) {
      if (awaitingModelSelectionRef.current) return;
      modelRequestIdRef.current += 1;
      setSelectedCompanyMakeId("");
      setSelectedModelId("");
      setModels([]);
      setIsLoadingModels(false);
      return;
    }

    const requestId = modelRequestIdRef.current + 1;
    modelRequestIdRef.current = requestId;

    setIsLoadingModels(true);
    setLoadError("");

    modelService
      .getAllModelsByMakeId(normalizedInitialMakeId)
      .then((res) => {
        if (modelRequestIdRef.current !== requestId) return;

        const nextModels = Array.isArray(res?.item) ? res.item : [];
        const firstModel = nextModels[0];
        const initialModelExists = nextModels.some(
          (model) => String(model.id) === normalizedInitialModelId,
        );

        setModels(nextModels);
        setSelectedCompanyMakeId(
          firstModel?.companyMakeId
            ? String(firstModel.companyMakeId)
            : normalizedInitialMakeId,
        );
        setSelectedModelId(
          initialModelExists ? normalizedInitialModelId : "",
        );
      })
      .catch((error) => {
        if (modelRequestIdRef.current !== requestId) return;
        console.error("Failed to load models", error);
        setModels([]);
        setSelectedCompanyMakeId("");
        setSelectedModelId("");
        setLoadError("Unable to load models.");
      })
      .finally(() => {
        if (modelRequestIdRef.current === requestId) {
          setIsLoadingModels(false);
        }
      });
  }, [initialMakeId, initialModelId]);

  const loadModelsForCompany = (companyMakeId) => {
    const requestId = modelRequestIdRef.current + 1;
    modelRequestIdRef.current = requestId;

    setIsLoadingModels(true);
    setLoadError("");

    modelService
      .getAllModelsByMakeId(companyMakeId)
      .then((res) => {
        if (modelRequestIdRef.current !== requestId) return;
        setModels(Array.isArray(res?.item) ? res.item : []);
      })
      .catch((error) => {
        if (modelRequestIdRef.current !== requestId) return;
        console.error("Failed to load models", error);
        setModels([]);
        setLoadError("Unable to load models.");
      })
      .finally(() => {
        if (modelRequestIdRef.current === requestId) {
          setIsLoadingModels(false);
        }
      });
  };

  const handleMakeChange = (event) => {
    const companyMakeId = event.target.value;

    awaitingModelSelectionRef.current = Boolean(companyMakeId);
    setSelectedCompanyMakeId(companyMakeId);
    setSelectedModelId("");
    setModels([]);

    // A company by itself is not a valid Parts.MakeId. Wait until the user
    // selects a model, then return that model's actual company/model-pair ID.
    onSelectionChange?.({
      makeId: "",
      modelId: "",
      companyMakeId,
    });

    if (!companyMakeId) {
      modelRequestIdRef.current += 1;
      setIsLoadingModels(false);
      return;
    }

    loadModelsForCompany(companyMakeId);
  };

  const handleModelChange = (event) => {
    const modelId = event.target.value;
    // Keep the company selection when a model is cleared, but resume normal
    // prop synchronization once a valid model pair is chosen.
    awaitingModelSelectionRef.current = Boolean(selectedCompanyMakeId && !modelId);
    setSelectedModelId(modelId);

    const selectedModel = models.find(
      (model) => String(model.id) === String(modelId),
    );

    onSelectionChange?.({
      makeId: selectedModel?.makeId ? String(selectedModel.makeId) : "",
      modelId: selectedModel?.id ? String(selectedModel.id) : "",
      companyMakeId: selectedCompanyMakeId,
      company: selectedModel?.company || "",
      modelName: selectedModel?.name || "",
    });
  };

  const companySelectId = `${idPrefix}-company`;
  const modelSelectId = `${idPrefix}-model`;

  return (
    <div className="make-model-selector">
      <div className="make-model-selector__field">
        <label htmlFor={companySelectId}>Make</label>
        <select
          id={companySelectId}
          className="apd-input"
          value={selectedCompanyMakeId}
          onChange={handleMakeChange}
          disabled={disabled || isLoadingMakes}
        >
          <option value="">
            {isLoadingMakes ? "Loading makes..." : "Select Make"}
          </option>
          {makes.map((make) => (
            <option key={make.id} value={make.id}>
              {make.company}
            </option>
          ))}
        </select>
      </div>

      <div className="make-model-selector__field">
        <label htmlFor={modelSelectId}>Model</label>
        <select
          id={modelSelectId}
          className="apd-input"
          value={selectedModelId}
          onChange={handleModelChange}
          disabled={disabled || !selectedCompanyMakeId || isLoadingModels}
        >
          <option value="">
            {isLoadingModels ? "Loading models..." : "Select Model"}
          </option>
          {models.map((model) => (
            <option key={model.makeId || model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </div>

      {loadError ? (
        <div className="make-model-selector__error" role="alert">
          {loadError}
        </div>
      ) : null}
    </div>
  );
}

export default MakeModelSelector;
