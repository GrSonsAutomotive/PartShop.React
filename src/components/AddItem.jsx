import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toastr from "toastr";

import "./AdminPartDetails.css";
import "./add-item.css";

import addItem from "../itemPhotos/add_item.png";
import MakeModelSelector from "./MakeModelSelector";
import LocationSelector from "./LocationSelector";
import ImageDropZone from "./ImageDropZone";
import catagoryService from "../service/catagoryService";
import partsService from "../service/partsService";
import conditionService from "../service/conditionService";
import shippingPolicyService from "../service/shippingPolicyService";

const initialForm = {
  name: "",
  year: "",
  partNumber: "",
  brand: "",
  description: "",
  price: "",
  quantity: "1",
  makeId: "",
  modelId: "",
  catagoryId: "",
  conditionId: "1",
  shippingPolicyId: "",
  locationId: "",
  availableId: "1",
  otherBox: "",
  adminNotes: "",
};

function AddItem() {
  const navigate = useNavigate();

  const [catagoryOptions, setCatagoryOptions] = useState([]);
  const [conditionOptions, setConditionOptions] = useState([]);
  const [shippingPolicyOptions, setShippingPolicyOptions] = useState([]);

  const [formData, setFormData] = useState(initialForm);
  const [extraCategories, setExtraCategories] = useState([]);
  const [fitments, setFitments] = useState([]);

  const [galleryItems, setGalleryItems] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const galleryItemsRef = useRef([]);

  const selectedItem = galleryItems[selectedIndex] || null;
  const mainPreviewUrl = selectedItem?.previewUrl || addItem;
  const mainRotation = selectedItem?.rotation || 0;

  const [searchParams] = useSearchParams();
  const sellSimilarId = searchParams.get("sellSimilarId");

  const [loadingClone, setLoadingClone] = useState(false);
  const [initialLocationValue, setInitialLocationValue] = useState(null);
  const [locationSelectorKey, setLocationSelectorKey] = useState(0);

  useEffect(() => {
    catagoryService
      .getAllCatagories()
      .then((res) => setCatagoryOptions(res.item || []))
      .catch(() => toastr.error("Failed to load categories.", "Error"));

    conditionService
      .getAllConditions()
      .then((res) => setConditionOptions(res.item || []))
      .catch(() => toastr.error("Failed to load conditions.", "Error"));

    shippingPolicyService
      .getAllShippingPolicies()
      .then((res) => setShippingPolicyOptions(res.item || []))
      .catch(() => toastr.error("Failed to load shipping policies.", "Error"));
  }, []);

  const revokePreviewUrls = (items) => {
    (items || []).forEach((item) => {
      if (item?.previewUrl && item.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
  };

  useEffect(() => {
    galleryItemsRef.current = galleryItems;
  }, [galleryItems]);

  useEffect(() => {
    return () => {
      revokePreviewUrls(galleryItemsRef.current);
    };
  }, []);

  useEffect(() => {
    if (!sellSimilarId) return;

    let isMounted = true;
    setLoadingClone(true);

    partsService
      .getPartById(sellSimilarId)
      .then((partRes) => {
        if (!isMounted) return;

        const sourcePart = partRes?.item;

        if (!sourcePart) {
          toastr.error("Could not load source part for Sell Similar.");
          return;
        }

        hydrateFromSourcePart(sourcePart);
        toastr.success(
          "Listing details copied. Add new photos; the inventory location was carried over.",
        );
      })
      .catch((err) => {
        console.error("Sell Similar load failed", err);
        toastr.error("Failed to preload Sell Similar data.");
      })
      .finally(() => {
        if (isMounted) {
          setLoadingClone(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [sellSimilarId]);

  const requiredMissing = useMemo(() => {
    const required = [
      "name",
      "partNumber",
      "price",
      "catagoryId",
      "makeId",
      "modelId",
      "conditionId",
      "shippingPolicyId",
      "locationId",
      "description",
    ];

    return required.filter((k) => !String(formData[k] ?? "").trim());
  }, [formData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleMakeModelChange = ({ makeId, modelId }) => {
    setFormData((prev) => ({
      ...prev,
      makeId: makeId ? String(makeId) : "",
      modelId: modelId ? String(modelId) : "",
    }));
  };

  const handleLocationChange = (loc) => {
    setFormData((prev) => ({
      ...prev,
      locationId: loc?.locationId ? String(loc.locationId) : "",
    }));
  };

  const addExtraCategory = () => {
    setExtraCategories((prev) => [...prev, { catagoryId: "" }]);
  };

  const updateExtraCategory = (index, value) => {
    setExtraCategories((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, catagoryId: value } : item,
      ),
    );
  };

  const removeExtraCategory = (index) => {
    setExtraCategories((prev) => prev.filter((_, i) => i !== index));
  };

  const addFitment = () => {
    setFitments((prev) => [
      ...prev,
      {
        makeId: "",
        modelId: "",
        yearStart: "",
        yearEnd: "",
      },
    ]);
  };

  const updateFitment = (index, field, value) => {
    setFitments((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const updateFitmentSelection = (index, { makeId, modelId }) => {
    setFitments((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              makeId: makeId ? String(makeId) : "",
              modelId: modelId ? String(modelId) : "",
            }
          : item,
      ),
    );
  };

  const removeFitment = (index) => {
    setFitments((prev) => prev.filter((_, i) => i !== index));
  };

  const safeString = (value) => (value == null ? "" : String(value));

  const parseYearRange = (value) => {
    const text = safeString(value)
      .trim()
      .replace(/[–—]/g, "-");

    const match = text.match(/^(\d{4})(?:\s*-\s*(\d{4}))?$/);

    if (!match) return null;

    const yearStart = Number(match[1]);
    const yearEnd = Number(match[2] || match[1]);

    if (!Number.isInteger(yearStart) || !Number.isInteger(yearEnd)) {
      return null;
    }

    if (yearStart > yearEnd) return null;

    return { yearStart, yearEnd };
  };

  const formatYearRange = (yearStart, yearEnd) => {
    if (yearStart == null || yearEnd == null || yearStart === "" || yearEnd === "") {
      return "";
    }

    return Number(yearStart) === Number(yearEnd)
      ? String(yearStart)
      : `${yearStart} - ${yearEnd}`;
  };

  const hydrateFromSourcePart = (sourcePart) => {
    if (!sourcePart) return;

    const categories = Array.isArray(sourcePart.categories)
      ? sourcePart.categories
      : [];

    const fitmentsRaw = Array.isArray(sourcePart.fitments)
      ? sourcePart.fitments
      : [];

    const primaryCategoryId = safeString(
      sourcePart.catagoryId ??
        sourcePart.catagory?.id ??
        categories[0]?.catagoryId,
    );

    const sourcePrimaryMakeId = safeString(
      sourcePart.makeId ?? sourcePart.make?.id ?? fitmentsRaw[0]?.makeId,
    );

    const sourcePrimaryModelId = safeString(
      sourcePart.modelId ??
        sourcePart.make?.model?.id ??
        fitmentsRaw.find(
          (fitment) =>
            safeString(fitment.makeId) === sourcePrimaryMakeId,
        )?.modelId,
    );

    const sourceYearRange = parseYearRange(sourcePart.year);

    let primaryFitmentIndex = fitmentsRaw.findIndex((fitment) => {
      if (safeString(fitment.makeId) !== sourcePrimaryMakeId) return false;
      if (!sourceYearRange) return true;

      return (
        Number(fitment.yearStart) === sourceYearRange.yearStart &&
        Number(fitment.yearEnd) === sourceYearRange.yearEnd
      );
    });

    if (primaryFitmentIndex < 0 && fitmentsRaw.length > 0) {
      primaryFitmentIndex = 0;
    }

    const primaryFitment =
      primaryFitmentIndex >= 0 ? fitmentsRaw[primaryFitmentIndex] : null;

    const primaryYearText = sourceYearRange
      ? formatYearRange(sourceYearRange.yearStart, sourceYearRange.yearEnd)
      : primaryFitment
        ? formatYearRange(primaryFitment.yearStart, primaryFitment.yearEnd)
        : safeString(sourcePart.year);

    setFormData((prev) => ({
      ...prev,
      name: safeString(sourcePart.name),
      year: primaryYearText,
      partNumber: safeString(sourcePart.partnumber ?? sourcePart.partNumber),
      brand: safeString(sourcePart.brand ?? sourcePart.Brand),
      description: safeString(sourcePart.description),
      price: safeString(sourcePart.price),
      quantity: safeString(sourcePart.quantity ?? "1"),
      makeId: sourcePrimaryMakeId,
      modelId: sourcePrimaryModelId,
      catagoryId: primaryCategoryId,
      conditionId: safeString(
        sourcePart.conditionId ?? sourcePart.condition?.id ?? "1",
      ),
      shippingPolicyId: safeString(
        sourcePart.shippingPolicyId ?? sourcePart.shippingPolicy?.id,
      ),
      locationId: safeString(
        sourcePart.locationId ??
          sourcePart.location?.id ??
          sourcePart.location?.box?.id ??
          sourcePart.boxId,
      ),
      availableId: "1",
      otherBox: safeString(sourcePart.otherBox ?? sourcePart.OtherBox),
      adminNotes: "",
    }));

    setExtraCategories(
      categories
        .filter((category) =>
          safeString(category.catagoryId ?? category.id) !== primaryCategoryId,
        )
        .map((category) => ({
          catagoryId: safeString(category.catagoryId ?? category.id),
        })),
    );

    setFitments(
      fitmentsRaw
        .filter((_, index) => index !== primaryFitmentIndex)
        .map((fitment) => ({
          makeId: safeString(fitment.makeId),
          modelId: safeString(fitment.modelId),
          yearStart: safeString(fitment.yearStart),
          yearEnd: safeString(fitment.yearEnd),
        })),
    );

    // Photos are unique to the new listing, but the client wants the
    // existing inventory location carried into Sell Similar.
    revokePreviewUrls(galleryItemsRef.current);
    setGalleryItems([]);
    setSelectedIndex(0);

    setInitialLocationValue({
      siteId: sourcePart.siteId ?? sourcePart.location?.site?.id ?? "",
      areaId: sourcePart.areaId ?? sourcePart.location?.area?.id ?? "",
      aisleId: sourcePart.aisleId ?? sourcePart.location?.aisle?.id ?? "",
      shelfId: sourcePart.shelfId ?? sourcePart.location?.shelf?.id ?? "",
      sectionId:
        sourcePart.sectionId ?? sourcePart.location?.section?.id ?? "",
      boxId: sourcePart.boxId ?? sourcePart.location?.box?.id ?? "",
    });

    setLocationSelectorKey((value) => value + 1);
  };

  const setGalleryFromDropZone = (files) => {
    const nextFiles = files || [];

    setGalleryItems((prev) => {
      // Preserve preview URLs and rotation for files that are already in the
      // gallery. ImageDropZone now appends new drops, so rebuilding every
      // gallery item here would unnecessarily reset existing photo rotations.
      const nextFileSet = new Set(nextFiles);
      prev.forEach((item) => {
        if (!nextFileSet.has(item.file) && item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });

      return nextFiles.map((file, index) => {
        const existing = prev.find((item) => item.file === file);
        if (existing) {
          return existing;
        }

        return {
          id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
          file,
          previewUrl: URL.createObjectURL(file),
          rotation: 0,
        };
      });
    });

    setSelectedIndex((current) =>
      nextFiles.length === 0 ? 0 : Math.min(current, nextFiles.length - 1),
    );
  };

  const clearGallery = () => {
    setGalleryFromDropZone([]);
  };

  const rotateSelected = (delta) => {
    setGalleryItems((prev) =>
      prev.map((item, index) => {
        if (index !== selectedIndex) {
          return item;
        }

        return {
          ...item,
          rotation: (item.rotation + delta + 360) % 360,
        };
      }),
    );
  };

  const loadImageFromFile = (file) =>
    new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`Failed to load image: ${file.name}`));
      };

      img.src = objectUrl;
    });

  const canvasToBlob = (canvas, type = "image/jpeg", quality = 0.92) =>
    new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas conversion failed."));
            return;
          }

          resolve(blob);
        },
        type,
        quality,
      );
    });

  const rotateFile = async (file, rotation) => {
    const normalized = ((rotation % 360) + 360) % 360;

    if (normalized === 0) {
      return file;
    }

    const img = await loadImageFromFile(file);

    const swapSides = normalized === 90 || normalized === 270;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Canvas context unavailable.");
    }

    canvas.width = swapSides ? img.height : img.width;
    canvas.height = swapSides ? img.width : img.height;

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((normalized * Math.PI) / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);

    const outputType =
      file.type === "image/png" || file.type === "image/webp"
        ? file.type
        : "image/jpeg";

    const blob = await canvasToBlob(canvas, outputType);

    return new File([blob], file.name, {
      type: outputType,
      lastModified: Date.now(),
    });
  };

  const buildRotatedFilesForUpload = async (items) => {
    const rotatedFiles = [];

    for (const item of items) {
      if (!item?.file) {
        continue;
      }

      const rotatedFile = await rotateFile(item.file, item.rotation);
      rotatedFiles.push(rotatedFile);
    }

    return rotatedFiles;
  };

  const getFitmentValidationError = () => {
    const normalizedFitments = [];
    const primaryYearText = String(formData.year || "").trim();
    const primaryRange = primaryYearText ? parseYearRange(primaryYearText) : null;

    if (primaryYearText && !primaryRange) {
      return "Year(s) must be a four-digit year or closed range such as 1972 - 1979.";
    }

    if (formData.makeId) {
      normalizedFitments.push({
        makeId: String(formData.makeId),
        yearStart: primaryRange?.yearStart ?? null,
        yearEnd: primaryRange?.yearEnd ?? null,
        label: "Primary fitment",
      });
    }

    for (let index = 0; index < fitments.length; index++) {
      const fitment = fitments[index];
      const rowNumber = index + 1;
      const hasAnyValue = Boolean(
        fitment.makeId || fitment.modelId || fitment.yearStart || fitment.yearEnd,
      );

      if (!hasAnyValue) continue;

      if (!fitment.makeId || !fitment.modelId) {
        return `Additional fitment ${rowNumber} needs both a make and model.`;
      }

      const yearStartText = String(fitment.yearStart || "").trim();
      const yearEndText = String(fitment.yearEnd || "").trim();
      const hasYearStart = Boolean(yearStartText);
      const hasYearEnd = Boolean(yearEndText);

      if (hasYearStart !== hasYearEnd) {
        return `Additional fitment ${rowNumber} needs both a start and end year, or neither.`;
      }

      let yearStart = null;
      let yearEnd = null;

      if (hasYearStart && hasYearEnd) {
        yearStart = Number(yearStartText);
        yearEnd = Number(yearEndText);

        if (!Number.isInteger(yearStart) || !Number.isInteger(yearEnd)) {
          return `Additional fitment ${rowNumber} needs valid whole-number years.`;
        }

        if (yearStart > yearEnd) {
          return `Additional fitment ${rowNumber} has a start year after its end year.`;
        }
      }

      normalizedFitments.push({
        makeId: String(fitment.makeId),
        yearStart,
        yearEnd,
        label: `Additional fitment ${rowNumber}`,
      });
    }

    const seen = new Map();

    for (const fitment of normalizedFitments) {
      const key = `${fitment.makeId}|${fitment.yearStart ?? ""}|${fitment.yearEnd ?? ""}`;

      if (seen.has(key)) {
        return `${fitment.label} duplicates ${seen.get(key)}.`;
      }

      seen.set(key, fitment.label);
    }

    return "";
  };

  const buildPayload = () => {
    const payload = new FormData();

    payload.append("Name", formData.name.trim());
    payload.append("CatagoryId", formData.catagoryId);
    payload.append("MakeId", formData.makeId);
    const primaryYearText = String(formData.year || "").trim();
    const primaryRange = primaryYearText ? parseYearRange(primaryYearText) : null;

    if (primaryRange) {
      payload.append(
        "Year",
        formatYearRange(primaryRange.yearStart, primaryRange.yearEnd),
      );
    }
    payload.append("ShippingPolicyId", formData.shippingPolicyId);
    payload.append("PartNumber", formData.partNumber.trim());
    if (String(formData.brand || "").trim()) {
      payload.append("Brand", formData.brand.trim());
    }
    payload.append("Description", formData.description.trim());
    payload.append("Price", formData.price);
    payload.append("Quantity", formData.quantity || "1");
    payload.append("LocationId", formData.locationId);
    payload.append("AvailableId", formData.availableId || "1");
    payload.append("ConditionId", formData.conditionId);

    if (String(formData.otherBox || "").trim()) {
      payload.append("OtherBox", formData.otherBox.trim());
    }

    if (String(formData.adminNotes || "").trim()) {
      payload.append("AdminNotes", formData.adminNotes.trim());
    }

    payload.append("Categories[0].CatagoryId", formData.catagoryId);

    let categoryIndex = 1;
    extraCategories.forEach((cat) => {
      const catagoryId = String(cat.catagoryId || "").trim();

      if (catagoryId) {
        payload.append(`Categories[${categoryIndex}].CatagoryId`, catagoryId);
        categoryIndex++;
      }
    });

    let fitmentIndex = 0;

    if (String(formData.makeId || "").trim()) {
      payload.append(
        `Fitments[${fitmentIndex}].MakeId`,
        String(formData.makeId),
      );

      if (primaryRange) {
        payload.append(
          `Fitments[${fitmentIndex}].YearStart`,
          String(primaryRange.yearStart),
        );
        payload.append(
          `Fitments[${fitmentIndex}].YearEnd`,
          String(primaryRange.yearEnd),
        );
      }

      fitmentIndex++;
    }

    fitments.forEach((fitment) => {
      const makeId = String(fitment.makeId || "").trim();
      const yearStart = String(fitment.yearStart || "").trim();
      const yearEnd = String(fitment.yearEnd || "").trim();

      if (makeId) {
        payload.append(`Fitments[${fitmentIndex}].MakeId`, makeId);

        if (yearStart && yearEnd) {
          payload.append(`Fitments[${fitmentIndex}].YearStart`, yearStart);
          payload.append(`Fitments[${fitmentIndex}].YearEnd`, yearEnd);
        }

        fitmentIndex++;
      }
    });

    return payload;
  };

  const submitEvent = async (e) => {
    e?.preventDefault?.();

    const hasAnyImage = galleryItems.some((item) => item?.previewUrl);

    if (!hasAnyImage) {
      toastr.error("At least one image is required.");
      return;
    }

    if (requiredMissing.length > 0) {
      toastr.error(`Missing required fields: ${requiredMissing.join(", ")}`);
      return;
    }

    if (Number(formData.price) <= 0) {
      toastr.error("Price must be greater than 0.");
      return;
    }

    if (Number(formData.quantity) < 0) {
      toastr.error("Quantity cannot be negative.");
      return;
    }

    const fitmentValidationError = getFitmentValidationError();

    if (fitmentValidationError) {
      toastr.error(fitmentValidationError);
      return;
    }

    let newId = null;
    try {
      setSubmitting(true);

      const policy = shippingPolicyOptions.find(
        (item) => String(item.id) === String(formData.shippingPolicyId),
      );
      if (!policy) {
        toastr.error("Select a valid shipping policy before submitting.");
        return;
      }

      const payload = buildPayload();
      const res = await partsService.addPart(payload);
      newId = res?.item ?? res;

      if (!Number.isInteger(Number(newId)) || Number(newId) <= 0) {
        toastr.error("Part insert returned an invalid ID. Check inventory before retrying.");
        return;
      }

      // IMPORTANT: Gallery uploads happen after add-new. Publishing before
      // completing the gallery exposes a part with missing photographs.
      const rotatedFiles = await buildRotatedFilesForUpload(galleryItems);
      if (rotatedFiles.length > 0) {
        await partsService.addPartImages(newId, rotatedFiles);
      }

      // Contact-only policies are intentionally not published for checkout.
      // The server validates the shipping class, Shopify collection membership,
      // inventory, photos and final SQL availability on every publish request.
      if (policy.allowsOnlineCheckout === true) {
        if (Number(formData.quantity) < 1) {
          toastr.warning(
            "Part saved as Pending because quantity is zero. Add stock and publish from the part page.",
          );
        } else {
          // One best-effort request: do not block inventory entry while Shopify publishes.
          // The API alone promotes Pending to Available after confirming publication.
          // If Shopify cannot confirm, the admin can use the Pending Publishing tool.
          partsService.publishShopifyProduct(newId)
            .then((response) => {
              const result = response?.data?.item;
              if (result?.publishedToOnlineStore === true &&
                  String(result.status).toUpperCase() === "ACTIVE") {
                toastr.success(`Part #${newId} published to Shopify.`);
              } else {
                console.warn("Shopify publication not confirmed", newId, result);
                toastr.warning(
                  `Publication not confirmed for part #${newId}. Check Pending Publishing.`,
                  "Publication pending",
                );
              }
            })
            .catch((error) => {
              console.warn("Automatic Shopify publication did not complete", newId, error);
              toastr.warning(
                `Publication not confirmed for part #${newId}. Check Pending Publishing.`,
                "Publication pending",
              );
            });

          toastr.success("Part saved and photos uploaded. Shopify publishing started.");
        }
      } else {
        toastr.success(
          policy.allowsOnlineCheckout === false
            ? "Contact-only part saved. Checkout publishing is intentionally disabled."
            : "Part saved. Confirm shipping policy configuration before publishing.",
        );
      }

      navigate(`/admin/part/${newId}`);
    } catch (err) {
      console.error("Add part workflow failed", err);

      // The SQL row can already exist even if a later image upload fails.
      // Never encourage submitting a second duplicate inventory item.
      if (newId) {
        toastr.error(
          "Part was created, but a later step failed. Review photos and " +
            "publish from the existing part page instead of submitting again.",
        );
        navigate(`/admin/part/${newId}`);
      } else {
        const apiErrors =
          err?.response?.data?.errors ||
          err?.response?.data?.Errors ||
          (err?.response?.data?.message ? [err.response.data.message] : null);
        toastr.error(
          (Array.isArray(apiErrors) ? apiErrors.join(" | ") : null) ||
            "Failed to add part.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-part-details apd-add">
      <header className="apd-header">
        <div className="apd-title">
          <h2>{sellSimilarId ? "Sell Similar" : "Add Part"}</h2>
          <span className="apd-badge apd-badge--pending">
            {sellSimilarId ? "Cloned Draft" : "Draft"}
          </span>
        </div>

        <div className="apd-header-actions">
          <button
            type="submit"
            form="add-part-form"
            className="apd-btn apd-btn--primary"
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>

        <div className="apd-subtle">
          Fill out Specs, Location, Compatibility & Categories, then submit.
        </div>
      </header>

      <section className="apd-layout">
        <form id="add-part-form" onSubmit={submitEvent} className="apd-grid">
          <aside className="apd-card apd-media">
            <img
              src={mainPreviewUrl}
              alt="Preview"
              className="apd-photo"
              style={{
                transform: `rotate(${mainRotation}deg)`,
                transition: "transform 0.2s ease",
              }}
            />

            <div className="apd-actions">
              <ImageDropZone
                files={galleryItems.map((item) => item.file)}
                onFilesChange={setGalleryFromDropZone}
                disabled={submitting}
                showUploadButton={false}
                title="Add Photos (Drag & Drop or Click)"
                helper="Primary image will be the first file."
              />
            </div>

            {galleryItems.length > 0 && (
              <>
                <div className="apd-actions">
                  <button
                    type="button"
                    className="apd-btn apd-btn--outlined"
                    onClick={() => rotateSelected(-90)}
                    disabled={submitting}
                  >
                    Rotate Left
                  </button>

                  <button
                    type="button"
                    className="apd-btn apd-btn--outlined"
                    onClick={() => rotateSelected(90)}
                    disabled={submitting}
                  >
                    Rotate Right
                  </button>

                  <button
                    type="button"
                    className="apd-btn apd-btn--outlined"
                    onClick={clearGallery}
                    disabled={submitting}
                  >
                    Clear Photos
                  </button>
                </div>

                <div className="apd-gallery">
                  <div className="apd-gallery__label">Gallery Preview</div>

                  <div className="apd-thumbs">
                    {galleryItems.map((item, idx) => (
                      <button
                        type="button"
                        key={item.id}
                        className={`apd-thumb ${idx === selectedIndex ? "is-active" : ""}`}
                        title={`Gallery image ${idx + 1}`}
                        onClick={() => setSelectedIndex(idx)}
                      >
                        <img
                          src={item.previewUrl}
                          alt={`Gallery ${idx + 1}`}
                          style={{
                            transform: `rotate(${item.rotation}deg)`,
                            transition: "transform 0.2s ease",
                          }}
                        />
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="apd-btn apd-btn--outlined apd-btn--sm"
                    disabled={submitting}
                    onClick={clearGallery}
                  >
                    Clear Gallery
                  </button>
                </div>
              </>
            )}
          </aside>

          <article className="apd-card apd-specs">
            <h3>Specs</h3>

            <dl className="apd-dl apd-form-dl">
              <div>
                <dt>Name</dt>
                <dd>
                  <input
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="apd-input"
                  />
                </dd>
              </div>

              <div>
                <dt>Year(s) <span className="apd-subtle">(optional)</span></dt>
                <dd>
                  <input
                    name="year"
                    value={formData.year}
                    onChange={handleChange}
                    className="apd-input"
                    placeholder="Optional: 1972 or 1972 - 1979"
                  />
                </dd>
              </div>

              <div>
                <dt>Part #</dt>
                <dd>
                  <input
                    name="partNumber"
                    value={formData.partNumber}
                    onChange={handleChange}
                    className="apd-input"
                  />
                </dd>
              </div>

              <div>
                <dt>Brand <span className="apd-subtle">(optional)</span></dt>
                <dd>
                  <input
                    name="brand"
                    value={formData.brand}
                    onChange={handleChange}
                    className="apd-input"
                    maxLength={128}
                    placeholder="e.g. Bosch, Mahle, Lemförder"
                  />
                </dd>
              </div>

              <div>
                <dt>Price</dt>
                <dd>
                  <input
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    className="apd-input"
                    inputMode="decimal"
                  />
                </dd>
              </div>

              <div>
                <dt>Quantity</dt>
                <dd>
                  <input
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleChange}
                    className="apd-input"
                    inputMode="numeric"
                  />
                </dd>
              </div>

              <div>
                <dt>Condition</dt>
                <dd>
                  <select
                    name="conditionId"
                    value={formData.conditionId}
                    onChange={handleChange}
                    className="apd-input"
                  >
                    <option value="">Select Condition</option>
                    {conditionOptions.map((condition) => (
                      <option key={condition.id} value={condition.id}>
                        {condition.name}
                      </option>
                    ))}
                  </select>
                </dd>
              </div>

              <div>
                <dt>Shipping Policy</dt>
                <dd>
                  <select
                    name="shippingPolicyId"
                    value={formData.shippingPolicyId}
                    onChange={handleChange}
                    className="apd-input"
                  >
                    <option value="">Select Shipping Policy</option>
                    {shippingPolicyOptions.map((policy) => (
                      <option key={policy.id} value={policy.id}>
                        {policy.name}
                      </option>
                    ))}
                  </select>
                </dd>
              </div>

              <div>
                <dt>Primary Category</dt>
                <dd>
                  <select
                    name="catagoryId"
                    value={formData.catagoryId}
                    onChange={handleChange}
                    className="apd-input"
                  >
                    <option value="">Select Category</option>
                    {catagoryOptions.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </dd>
              </div>

              <div className="apd-form-wide">
                <dd className="apd-form-wide-dd">
                  <MakeModelSelector
                    onSelectionChange={handleMakeModelChange}
                    initialMakeId={formData.makeId}
                    initialModelId={formData.modelId}
                  />
                </dd>
              </div>
            </dl>
          </article>

          <article className="apd-card apd-location">
            <h3>Location</h3>

            <div className="apd-location-picker">
              <LocationSelector
                key={locationSelectorKey}
                onChange={handleLocationChange}
                initialValue={initialLocationValue}
              />
            </div>

            <div className="apd-actions">
              <span className="apd-subtle">
                Selected Location ID: {formData.locationId || "—"}
              </span>
            </div>
          </article>

          <article className="apd-card apd-relations">
            <h3>Compatibility & Categories</h3>

            <div className="apd-relations-section">
              <div className="apd-relations-header">
                <h4>Additional Categories</h4>
                <button
                  type="button"
                  className="apd-btn apd-btn--outlined apd-btn--sm"
                  onClick={addExtraCategory}
                  disabled={submitting}
                >
                  Add Category
                </button>
              </div>

              <p className="apd-subtle">
                Primary category is selected in Specs. Add any secondary
                categories here.
              </p>

              {extraCategories.length === 0 ? (
                <div className="apd-empty-note">
                  No additional categories added.
                </div>
              ) : (
                <div className="apd-repeater">
                  {extraCategories.map((item, index) => {
                    const takenIds = [
                      String(formData.catagoryId || ""),
                      ...extraCategories
                        .map((x, i) =>
                          i === index ? null : String(x.catagoryId || ""),
                        )
                        .filter(Boolean),
                    ];

                    return (
                      <div
                        key={`extra-cat-${index}`}
                        className="apd-repeater-row"
                      >
                        <select
                          className="apd-input"
                          value={item.catagoryId}
                          onChange={(e) =>
                            updateExtraCategory(index, e.target.value)
                          }
                        >
                          <option value="">Select Category</option>
                          {catagoryOptions
                            .filter((cat) => !takenIds.includes(String(cat.id)))
                            .map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                        </select>

                        <button
                          type="button"
                          className="apd-btn apd-btn--outlined apd-btn--sm"
                          onClick={() => removeExtraCategory(index)}
                          disabled={submitting}
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="apd-relations-section">
              <div className="apd-relations-header">
                <h4>Additional Fitments</h4>
                <button
                  type="button"
                  className="apd-btn apd-btn--outlined apd-btn--sm"
                  onClick={addFitment}
                  disabled={submitting}
                >
                  Add Fitment
                </button>
              </div>

              <p className="apd-subtle">
                The primary fitment comes from the Specs make/model. Years are optional; add them only when known. Add cross-compatible fitments here.
              </p>

              {fitments.length === 0 ? (
                <div className="apd-empty-note">
                  No additional fitments added.
                </div>
              ) : (
                <div className="apd-repeater">
                  {fitments.map((fitment, index) => (
                    <div key={`fitment-${index}`} className="apd-fitment-row">
                      <div className="apd-fitment-row__selector">
                        <MakeModelSelector
                          idPrefix={`additional-fitment-${index}`}
                          initialMakeId={fitment.makeId}
                          initialModelId={fitment.modelId}
                          onSelectionChange={(selection) =>
                            updateFitmentSelection(index, selection)
                          }
                          disabled={submitting}
                        />
                      </div>

                      <label
                        className="apd-fitment-row__year"
                        htmlFor={`additional-fitment-${index}-year-start`}
                      >
                        <span>Year Start (optional)</span>
                        <input
                          id={`additional-fitment-${index}-year-start`}
                          className="apd-input"
                          inputMode="numeric"
                          placeholder="e.g. 1998"
                          value={fitment.yearStart}
                          onChange={(e) =>
                            updateFitment(index, "yearStart", e.target.value)
                          }
                        />
                      </label>

                      <label
                        className="apd-fitment-row__year"
                        htmlFor={`additional-fitment-${index}-year-end`}
                      >
                        <span>Year End (optional)</span>
                        <input
                          id={`additional-fitment-${index}-year-end`}
                          className="apd-input"
                          inputMode="numeric"
                          placeholder="e.g. 2005"
                          value={fitment.yearEnd}
                          onChange={(e) =>
                            updateFitment(index, "yearEnd", e.target.value)
                          }
                        />
                      </label>

                      <button
                        type="button"
                        className="apd-btn apd-btn--outlined apd-btn--sm apd-fitment-row__remove"
                        onClick={() => removeFitment(index)}
                        disabled={submitting}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </article>

          <article className="apd-card apd-meta">
            <h3>Meta</h3>

            <dl className="apd-dl apd-form-dl">
              <div>
                <dt>Availability</dt>
                <dd>
                  <select
                    name="availableId"
                    value={formData.availableId}
                    onChange={handleChange}
                    className="apd-input"
                  >
                    <option value="1">Available</option>
                    <option value="2">Unavailable</option>
                    <option value="3">Pending</option>
                  </select>
                </dd>
              </div>

              <div>
                <dt>Other Box</dt>
                <dd>
                  <input
                    name="otherBox"
                    value={formData.otherBox}
                    onChange={handleChange}
                    className="apd-input"
                  />
                </dd>
              </div>
            </dl>

            <div className="apd-desc">
              <h4>Description</h4>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="apd-textarea"
                rows={5}
              />
            </div>
            <div>
              <dt>Admin Notes</dt>
              <dd>
                <textarea
                  name="adminNotes"
                  value={formData.adminNotes}
                  onChange={handleChange}
                  className="apd-textarea"
                  rows={4}
                  placeholder="Internal admin-only notes. Not visible to customers."
                />
              </dd>
            </div>
          </article>
        </form>
      </section>
    </div>
  );
}

export default AddItem;
