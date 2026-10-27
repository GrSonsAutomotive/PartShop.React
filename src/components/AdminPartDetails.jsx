import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toastr from "toastr";
import partsService from "../service/partsService";
import availableService from "../service/availableService";
import conditionService from "../service/conditionService";
import shippingPolicyService from "../service/shippingPolicyService";
import catagoryService from "../service/catagoryService";
import "./AdminPartDetails.css";
import InLineNumber from "./InLineNumber";
import InLineSelect from "./InLineSelect";
import InLineText from "./InLineText";
import LocationModal from "./LocationModal";
import AuditHistory from "./AuditHistory";
import ImageDropZone from "./ImageDropZone";
import MakeModelSelector from "./MakeModelSelector";
import PhotoLightbox from "./PhotoLightbox";

function InlineShortText({
  value,
  maxLength = 128,
  disabled,
  allowEmpty = false,
  onSubmit,
  onCancel,
}) {
  const [draft, setDraft] = useState(value ?? "");

  const submit = () => {
    const next = draft.trim();
    if (!next && !allowEmpty) {
      toastr.error("This field cannot be blank.");
      return;
    }
    onSubmit(next);
  };

  return (
    <span className="apd-inline apd-inline--short-text">
      <input
        type="text"
        className="apd-input"
        value={draft}
        maxLength={maxLength}
        disabled={disabled}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel?.();
          }
        }}
      />
      <button type="button" className="apd-btn apd-btn--sm" disabled={disabled} onClick={submit}>
        Save
      </button>
      <button
        type="button"
        className="apd-btn apd-btn--sm apd-btn--outlined"
        disabled={disabled}
        onClick={onCancel}
      >
        Cancel
      </button>
    </span>
  );
}

function AdminPartDetails() {
  const { id } = useParams();

  const [part, setPart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shippingChangeInProgress, setShippingChangeInProgress] = useState(false);
  const [shippingJob, setShippingJob] = useState(null);
  const shippingJobSeenRef = useRef(null);
  const [auditRefreshToken, setAuditRefreshToken] = useState(0);
  const [conditionOptions, setConditionOptions] = useState([]);
  const [shippingPolicyOptions, setShippingPolicyOptions] = useState([]);
  const [availabilityOptions, setAvailabilityOptions] = useState([]);
  const [catagoryOptions, setCatagoryOptions] = useState([]);
  const [relationsEditing, setRelationsEditing] = useState(false);
  const [categoryDrafts, setCategoryDrafts] = useState([]);
  const [fitmentDrafts, setFitmentDrafts] = useState([]);
  const [isPublishingShopify, setIsPublishingShopify] = useState(false);
  const [isSyncingShopify, setIsSyncingShopify] = useState(false);
  const [isUnpublishingShopify, setIsUnpublishingShopify] = useState(false);
  const [shopifyPublishMessage, setShopifyPublishMessage] = useState("");
  const [shopifyPublishError, setShopifyPublishError] = useState("");

  const [images, setImages] = useState([]);
  const [activeImage, setActiveImage] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [newGalleryFiles, setNewGalleryFiles] = useState([]);

  const [locModalOpen, setLocModalOpen] = useState(false);
  const saveLockRef = useRef(false);

  const navigate = useNavigate();

  const handleSellSimilar = () => {
    navigate(`/admin/add?sellSimilarId=${vm.id}`);
  };

  const [edit, setEdit] = useState({
    name: false,
    partNumber: false,
    brand: false,
    price: false,
    quantity: false,
    availability: false,
    desc: false,
    otherBox: false,
    adminNotes: false,
    condition: false,
    shippingPolicy: false,
  });

  const get = (obj, ...keys) =>
    keys.reduce((o, k) => (o && o[k] != null ? o[k] : undefined), obj);

  const buildImageUrl = (img) => {
    if (!img) return "";
    if (/^https?:\/\//i.test(img)) return img;
    return `${partsService.partImageUrl}${img.startsWith("/") ? img : `/${img}`}`;
  };

  const fmtPrice = (n) =>
    typeof n === "number"
      ? n.toLocaleString(undefined, { style: "currency", currency: "USD" })
      : n;

  const showApiError = (err, fallback = "Update failed.") => {
    const msg =
      err?.response?.data?.errors?.[0] ||
      err?.response?.data?.error ||
      fallback;
    toastr.error(msg);
  };

  const onGetSuccess = (response) => {
    setPart(response.item);
    setLoading(false);
  };

  const onError = (err) => {
    console.error("AdminPartDetails error:", err);
    setLoading(false);

    const msg =
      err?.response?.data?.errors?.[0] ||
      err?.response?.data?.error ||
      "Failed to load part.";
    toastr.error(msg);
  };

  const refresh = () =>
    partsService.getPartById(id).then(onGetSuccess).catch(onError);

  const refreshImages = () =>
    partsService
      .getPartImagesByPartId(id)
      .then((res) => {
        const list = res?.item || [];
        setImages(list);
        const primary = list.find((x) => x.isPrimary) || list[0];
        setActiveImage(primary?.url ? buildImageUrl(primary.url) : "");
      })
      .catch(() => {
        setImages([]);
        setActiveImage("");
      });

  useEffect(() => {
    setLoading(true);
    partsService.getPartById(id).then(onGetSuccess).catch(onError);
    refreshImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);


  // Polling is strictly UI feedback. The job itself runs in the API and is
  // persisted in SQL; it continues after logout, navigation or tab closure.
  useEffect(() => {
    let mounted = true;
    const updateShippingStatus = async () => {
      try {
        const response = await partsService.getShippingReassignmentJob(id);
        if (!mounted) return;
        const next = response?.item || null;
        const old = shippingJobSeenRef.current;
        if (next?.status === "Completed" &&
            old?.jobId === next.jobId && old?.status !== "Completed") {
          toastr.success("Shopify shipping update completed; product republished.");
          partsService.getPartById(id).then(onGetSuccess).catch(onError);
          setAuditRefreshToken((t) => t + 1);
        }
        if (next?.status === "AttentionRequired" &&
            old?.jobId === next.jobId && old?.status !== "AttentionRequired") {
          toastr.error("Shipping update needs administrator review. The product should remain unpublished.");
        }
        shippingJobSeenRef.current = next;
        setShippingJob(next);
      } catch (e) {
        // In a deployment before the DEV SQL migration, avoid blocking the
        // rest of the Admin Part Details page. The mutation API remains gated.
        console.warn("Shipping job status unavailable", e);
      }
    };
    updateShippingStatus();
    const timer = window.setInterval(updateShippingStatus, 15000);
    return () => { mounted = false; window.clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onPublishToShopifyClicked = () => {
    if (!part?.id) {
      return;
    }

    const confirmed = window.confirm(
      "Publish this part to Shopify? This will sync its current quantity and photos, then make the product active.",
    );

    if (!confirmed) {
      return;
    }

    setIsPublishingShopify(true);
    setShopifyPublishMessage("");
    setShopifyPublishError("");

    partsService
      .publishShopifyProduct(part.id)
      .then((response) => {
        const result = response.data.item;

        setShopifyPublishMessage(
          `Published to Shopify. Status: ${
            result.status || "ACTIVE"
          }. Quantity: ${result.inventoryQuantity ?? 0}. Photos added: ${
            result.imagesAdded ?? 0
          }; already synced: ${result.imagesSkipped ?? 0}.`,
        );

        // Optional: reload details so any UI state refreshes.
        // getPartById(part.id);
      })
      .catch((error) => {
        const message =
          error?.response?.data?.errors?.[0] ||
          error?.response?.data?.message ||
          error.message ||
          "Unable to publish to Shopify.";

        setShopifyPublishError(message);
      })
      .finally(() => {
        setIsPublishingShopify(false);
      });
  };

  const onSyncWithShopifyClicked = () => {
    if (!part?.id) {
      return;
    }

    setIsSyncingShopify(true);
    setShopifyPublishMessage("");
    setShopifyPublishError("");

    partsService
      .syncShopifyProduct(part.id)
      .then((response) => {
        const result = response.data.item;
        const inventory = result.inventory || {};
        const media = result.media || {};

        setShopifyPublishMessage(
          `Shopify sync complete. Quantity: ${
            inventory.quantity ?? vm.quantity ?? 0
          }. Photos added: ${media.imagesAdded ?? 0}; already synced: ${
            media.imagesSkipped ?? 0
          }.`,
        );
      })
      .catch((error) => {
        const message =
          error?.response?.data?.errors?.[0] ||
          error?.response?.data?.message ||
          error.message ||
          "Unable to sync with Shopify.";

        setShopifyPublishError(message);
      })
      .finally(() => {
        setIsSyncingShopify(false);
      });
  };

  const onUnpublishFromShopifyClicked = () => {
    if (!part?.id) {
      return;
    }

    const confirmed = window.confirm(
      "Unpublish this part from Shopify? This will move the Shopify product back to Draft.",
    );

    if (!confirmed) {
      return;
    }

    setIsUnpublishingShopify(true);
    setShopifyPublishMessage("");
    setShopifyPublishError("");

    partsService
      .unpublishShopifyProduct(part.id)
      .then((response) => {
        const result = response.data.item;

        setShopifyPublishMessage(
          `Unpublished from Shopify. Status: ${result.status || "DRAFT"}`,
        );
      })
      .catch((error) => {
        const message =
          error?.response?.data?.errors?.[0] ||
          error?.response?.data?.message ||
          error.message ||
          "Unable to unpublish from Shopify.";

        setShopifyPublishError(message);
      })
      .finally(() => {
        setIsUnpublishingShopify(false);
      });
  };

  useEffect(() => {
    availableService
      .getAllAvailabilities()
      .then((res) => {
        const raw = res.item?.pagedItems || res.items || res.item || [];
        const opts = raw.map((a) => ({
          value: String(a.id),
          label: a.status || a.name || "",
        }));
        setAvailabilityOptions(opts);
      })
      .catch(onError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    conditionService
      .getAllConditions()
      .then((res) => {
        const raw = res.item || [];
        setConditionOptions(
          raw.map((c) => ({
            value: String(c.id),
            label: c.name || "",
          })),
        );
      })
      .catch(onError);
  }, []);

  useEffect(() => {
    shippingPolicyService
      .getAllShippingPolicies()
      .then((res) => {
        const raw = res.item || [];
        setShippingPolicyOptions(
          raw.map((sp) => ({
            value: String(sp.id),
            label: sp.name || "",
          })),
        );
      })
      .catch(onError);
  }, []);

  useEffect(() => {
    catagoryService
      .getAllCatagories()
      .then((res) => {
        const raw = res.item?.pagedItems || res.items || res.item || [];
        setCatagoryOptions(Array.isArray(raw) ? raw : []);
      })
      .catch(onError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vm = useMemo(() => {
    const p = part || {};

    const rawCategories = Array.isArray(p.categories) ? p.categories : [];
    const rawFitments = Array.isArray(p.fitments) ? p.fitments : [];

    const normalizedCategories = rawCategories
      .map((c) => ({
        id: c.id,
        catagoryId: c.catagoryId,
        catagoryName: c.catagoryName,
      }))
      .filter((c) => c.catagoryId || c.catagoryName);

    const normalizedFitments = rawFitments
      .map((f) => ({
        id: f.id,
        makeId: f.makeId,
        company: f.company,
        modelId: f.modelId,
        modelName: f.modelName,
        yearStart: f.yearStart,
        yearEnd: f.yearEnd,
      }))
      .filter((f) => f.makeId || f.company || f.modelName);

    return {
      id: p.id,
      name: p.name,
      category: p.catagoryName ?? get(p, "catagory", "name"),
      primaryCatagoryId: p.catagoryId ?? get(p, "catagory", "id"),
      company: p.company ?? get(p, "make", "company"),
      model: p.modelName ?? get(p, "make", "model", "name"),
      primaryMakeId: p.makeId ?? get(p, "make", "id"),
      primaryModelId: p.modelId ?? get(p, "make", "model", "id"),
      year: p.year,
      partNumber: p.partnumber ?? p.partNumber,
      brand: p.brand ?? p.Brand ?? "",

      availableStatus: p.availableStatus ?? get(p, "available", "status"),
      availableId: p.availableId ?? get(p, "available", "id"),

      conditionId: p.conditionId ?? get(p, "condition", "id"),
      conditionName: p.conditionName ?? get(p, "condition", "name"),

      shippingPolicyId: p.shippingPolicyId ?? get(p, "shippingPolicy", "id"),
      shippingPolicyName:
        p.shippingPolicyName ?? get(p, "shippingPolicy", "name"),
      allowsOnlineCheckout:
        (p.allowsOnlineCheckout ??
          get(p, "shippingPolicy", "allowsOnlineCheckout")) !== false,

      site: p.siteName ?? get(p, "location", "site", "name"),
      area: p.areaName ?? get(p, "location", "area", "name"),
      aisle: p.aisleName ?? get(p, "location", "aisle", "name"),
      shelf: p.shelfName ?? get(p, "location", "shelf", "name"),
      section: p.sectionName ?? get(p, "location", "section", "name"),
      box: p.boxName ?? get(p, "location", "box", "name"),
      otherBox: p.otherBox ?? p.OtherBox ?? p.other_box,
      adminNotes: p.adminNotes ?? p.AdminNotes ?? "",

      price: p.price,
      quantity: p.quantity,
      lastMovedBy: p.lastMovedBy ?? get(p, "user", "name"),
      dateCreated: p.datecreated ?? p.dateCreated,
      dateModified: p.datemodified ?? p.dateModified,

      image: buildImageUrl(p.image),
      rawImage: p.image || "",
      description: p.description,
      locationId: p.locationId ?? get(p, "location", "id"),
      location: p.location,

      categories: normalizedCategories,
      fitments: normalizedFitments,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part]);

  const initialLocation = {
    siteId: get(vm, "location", "site", "id") ?? null,
    areaId: get(vm, "location", "area", "id") ?? null,
    aisleId: get(vm, "location", "aisle", "id") ?? null,
    shelfId: get(vm, "location", "shelf", "id") ?? null,
    sectionId: get(vm, "location", "section", "id") ?? null,
    boxId: get(vm, "location", "box", "id") ?? null,
  };

  const patchAndRefresh = async (payload) => {
    if (saveLockRef.current) return;
    if (!payload || typeof payload !== "object") return;

    saveLockRef.current = true;
    setSaving(true);

    try {
      const response = await partsService.patchPart(payload, vm.id);
      const result = response?.item;

      if (result?.shopifySyncAttempted && !result.shopifySyncSucceeded) {
        toastr.warning(
          result.warning ||
            "Saved locally, but Shopify inventory did not sync.",
        );
      } else if (result?.shopifySyncSucceeded) {
        if (result.shopifyQuantity != null) {
          toastr.success(
            `Saved. Shopify quantity synced to ${result.shopifyQuantity}.`,
          );
        } else {
          toastr.success("Saved. Shopify status updated.");
        }
      } else {
        toastr.success("Saved.");
      }

      await refresh();
      setAuditRefreshToken((t) => t + 1);
      return true;
    } catch (e) {
      console.error("PATCH failed", e);
      showApiError(e, "Update failed.");
      return false;
    } finally {
      setSaving(false);
      saveLockRef.current = false;
      setEdit({
        name: false,
        partNumber: false,
        brand: false,
        price: false,
        quantity: false,
        availability: false,
        desc: false,
        otherBox: false,
        adminNotes: false,
        condition: false,
        shippingPolicy: false,
      });
    }
  };


  // Shipping-only changes use the existing PATCH for unmapped/legacy parts.
  // For products using Markets shipping, the dedicated guarded endpoint runs
  // the proven DRAFT -> tag -> collection -> SQL -> publication sequence.
  const changeShippingPolicy = async (selectedValue) => {
    const targetPolicyId = Number(selectedValue);
    const currentPolicyId = Number(vm.shippingPolicyId);
    if (!Number.isInteger(targetPolicyId) || targetPolicyId <= 0) {
      toastr.error("Select a valid shipping policy.");
      return;
    }
    if (targetPolicyId === currentPolicyId) {
      setEdit((e) => ({ ...e, shippingPolicy: false }));
      return;
    }
    if (!part?.shopifyProductId) {
      // A local-only part has no Shopify collection to migrate.
      await patchAndRefresh({ shippingPolicyId: targetPolicyId });
      return;
    }
    if (saveLockRef.current || shippingJob?.isOpen) {
      if (shippingJob?.isOpen) toastr.warning("This part already has a pending shipping update.");
      return;
    }
    saveLockRef.current = true;
    setSaving(true);
    setShippingChangeInProgress(true);
    let writeStarted = false;
    try {
      const preview = await partsService.getShippingReassignmentPlan(
        vm.id,
        targetPolicyId,
      );
      const plan = preview?.item;
      if (!plan || plan.currentShippingPolicyId !== currentPolicyId ||
          plan.targetShippingPolicyId !== targetPolicyId ||
          plan.shopifyProductGid !==
            `gid://shopify/Product/${part.shopifyProductId}`) {
        throw new Error(
          "The part changed since this page loaded. Refresh before changing its shipping policy.",
        );
      }

      if (!plan.marketDrivenShipping) {
        // Legacy delivery profiles retain their existing API behavior.
        const response = await partsService.patchPart(
          { shippingPolicyId: targetPolicyId },
          vm.id,
        );
        writeStarted = true;
        if (response?.item?.shopifySyncAttempted &&
            !response.item.shopifySyncSucceeded) {
          toastr.warning(
            response.item.warning ||
            "Saved locally, but Shopify shipping sync did not complete.",
          );
        } else {
          toastr.success("Shipping policy saved.");
        }
        await refresh();
        setAuditRefreshToken((t) => t + 1);
        setEdit((e) => ({ ...e, shippingPolicy: false }));
        return;
      }

      // The first approved Markets rollout supports checkout-to-checkout,
      // ACTIVE/published products with only automatic collection membership.
      if (plan.targetIsContactOnly) {
        throw new Error(
          "Changing a Shopify Markets product to contact-only shipping is not yet supported by the guarded reassignment workflow.",
        );
      }
      if (plan.targetHasMatchingTagSource !== true ||
          plan.currentShopifyTagMatchesSql !== true ||
          plan.shopifyProductStatus !== "ACTIVE" ||
          plan.shopifyPublishedOnOnlineStore !== true ||
          plan.oldManualSelectionScanComplete !== true ||
          plan.allMappedManualSelectionScansComplete !== true ||
          (plan.unmappedActiveCheckoutPolicyIds || []).length > 0 ||
          (plan.manualMembershipsAcrossMappedCollections || []).length > 0 ||
          (plan.collectionsWithIncompleteScans || []).length > 0) {
        throw new Error(
          "Shipping reassignment prerequisites did not pass. The product was not changed. Review the Shopify shipping reassignment plan.",
        );
      }

      const fromName = vm.shippingPolicyName || `Policy ${currentPolicyId}`;
      const toName =
        shippingPolicyOptions.find((p) => Number(p.value) === targetPolicyId)
          ?.label || `Policy ${targetPolicyId}`;
      const confirmed = window.confirm(
        `Change shipping for Part #${vm.id} from "${fromName}" to "${toName}"?\n\n` +
        "The update runs in the background. Shopify will temporarily unpublish " +
        "the item until its new shipping collection is verified. You may " +
        "continue other work or close this page. Do not submit the change twice.",
      );
      if (!confirmed) return;

      // From this point a network failure might mean the server completed
      // some writes. Never automatically retry or fall back to PATCH.
      writeStarted = true;
      const response = await partsService.queueShippingReassignment(vm.id, {
        expectedCurrentShippingPolicyId: currentPolicyId,
        targetShippingPolicyId: targetPolicyId,
        expectedShopifyProductGid: plan.shopifyProductGid,
        confirmation: "REASSIGN_MARKETS_SHIPPING_POLICY",
      });
      if (response?.item?.jobId == null) {
        throw new Error("Shipping job acceptance could not be confirmed. Check the status before submitting again.");
      }
      shippingJobSeenRef.current = response.item;
      setShippingJob(response.item);
      toastr.info("Shipping update queued. You can continue other work; no need to keep this page open.");
      setEdit((e) => ({ ...e, shippingPolicy: false }));
    } catch (error) {
      console.error("Shipping policy edit failed", error);
      const apiMessage =
        error?.response?.data?.errors?.[0] ||
        error?.response?.data?.error ||
        error?.message ||
        "Shipping policy change failed.";
      const extra =
        writeStarted && error?.response?.status !== 409 &&
        error?.response?.status !== 403
          ? " Do not retry; check the shipping job status before taking another action."
          : "";
      toastr.error(`${apiMessage}${extra}`);
      if (writeStarted) {
        // The API might have changed SQL or Shopify even if the browser
        // lost its connection. Reload the current part without resubmitting.
        await refresh();
      }
    } finally {
      setShippingChangeInProgress(false);
      setSaving(false);
      saveLockRef.current = false;
    }
  };

  const parseLegacyYear = (value) => {
    const text = String(value ?? "").trim().replace(/[–—]/g, "-");
    if (!text) return { yearStart: "", yearEnd: "" };

    const pieces = text.split("-").map((piece) => piece.trim()).filter(Boolean);
    if (pieces.length === 1 && /^\d{4}$/.test(pieces[0])) {
      return { yearStart: pieces[0], yearEnd: pieces[0] };
    }
    if (pieces.length === 2 && /^\d{4}$/.test(pieces[0]) && /^\d{4}$/.test(pieces[1])) {
      return { yearStart: pieces[0], yearEnd: pieces[1] };
    }
    return { yearStart: "", yearEnd: "" };
  };

  const beginRelationsEdit = () => {
    if (saving) return;

    const categories = vm.categories.map((cat) => ({
      catagoryId: String(cat.catagoryId || ""),
    }));

    const primaryCategoryIndex = categories.findIndex(
      (cat) => String(cat.catagoryId) === String(vm.primaryCatagoryId || ""),
    );
    if (primaryCategoryIndex > 0) {
      const [primary] = categories.splice(primaryCategoryIndex, 1);
      categories.unshift(primary);
    }
    if (categories.length === 0 && vm.primaryCatagoryId) {
      categories.push({ catagoryId: String(vm.primaryCatagoryId) });
    }

    const fitments = vm.fitments.map((fitment) => ({
      makeId: String(fitment.makeId || ""),
      companyMakeId: String(fitment.makeId || ""),
      modelId: String(fitment.modelId || ""),
      yearStart: fitment.yearStart == null ? "" : String(fitment.yearStart),
      yearEnd: fitment.yearEnd == null ? "" : String(fitment.yearEnd),
    }));

    const primaryRange = parseLegacyYear(vm.year);
    let primaryFitmentIndex = fitments.findIndex((fitment) => {
      if (String(fitment.makeId) !== String(vm.primaryMakeId || "")) return false;
      if (!primaryRange.yearStart && !primaryRange.yearEnd) {
        return !fitment.yearStart && !fitment.yearEnd;
      }
      return (
        String(fitment.yearStart) === primaryRange.yearStart &&
        String(fitment.yearEnd) === primaryRange.yearEnd
      );
    });
    if (primaryFitmentIndex < 0) {
      primaryFitmentIndex = fitments.findIndex(
        (fitment) => String(fitment.makeId) === String(vm.primaryMakeId || ""),
      );
    }
    if (primaryFitmentIndex > 0) {
      const [primary] = fitments.splice(primaryFitmentIndex, 1);
      fitments.unshift(primary);
    }
    if (fitments.length === 0 && vm.primaryMakeId) {
      fitments.push({
        makeId: String(vm.primaryMakeId),
        companyMakeId: String(vm.primaryMakeId),
        modelId: String(vm.primaryModelId || ""),
        yearStart: primaryRange.yearStart,
        yearEnd: primaryRange.yearEnd,
      });
    }

    setCategoryDrafts(categories);
    setFitmentDrafts(fitments);
    setRelationsEditing(true);
  };

  const updateCategoryDraft = (index, value) => {
    setCategoryDrafts((prev) =>
      prev.map((item, i) => (i === index ? { ...item, catagoryId: value } : item)),
    );
  };

  const addCategoryDraft = () => {
    setCategoryDrafts((prev) => [...prev, { catagoryId: "" }]);
  };

  const removeCategoryDraft = (index) => {
    setCategoryDrafts((prev) => prev.filter((_, i) => i !== index));
  };

  const updateFitmentDraft = (index, field, value) => {
    setFitmentDrafts((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const updateFitmentDraftSelection = (index, selection) => {
    setFitmentDrafts((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              makeId: selection.makeId ? String(selection.makeId) : "",
              companyMakeId: selection.companyMakeId
                ? String(selection.companyMakeId)
                : item.companyMakeId || "",
              modelId: selection.modelId ? String(selection.modelId) : "",
            }
          : item,
      ),
    );
  };

  const addFitmentDraft = () => {
    setFitmentDrafts((prev) => [
      ...prev,
      { makeId: "", companyMakeId: "", modelId: "", yearStart: "", yearEnd: "" },
    ]);
  };

  const removeFitmentDraft = (index) => {
    setFitmentDrafts((prev) => prev.filter((_, i) => i !== index));
  };

  const saveRelations = async () => {
    if (categoryDrafts.length === 0) {
      toastr.error("At least one category is required.");
      return;
    }
    if (fitmentDrafts.length === 0) {
      toastr.error("At least one make/model fitment is required.");
      return;
    }

    const categoryIds = categoryDrafts.map((item) => String(item.catagoryId || "").trim());
    if (categoryIds.some((value) => !value)) {
      toastr.error("Choose a category for every category row.");
      return;
    }
    if (new Set(categoryIds).size !== categoryIds.length) {
      toastr.error("A category cannot be assigned more than once.");
      return;
    }

    const normalizedFitments = [];
    const seenFitments = new Set();

    for (let index = 0; index < fitmentDrafts.length; index++) {
      const fitment = fitmentDrafts[index];
      const row = index + 1;
      if (!fitment.makeId || !fitment.modelId) {
        toastr.error(`Fitment ${row} needs both a make and model.`);
        return;
      }

      const startText = String(fitment.yearStart || "").trim();
      const endText = String(fitment.yearEnd || "").trim();
      if (Boolean(startText) !== Boolean(endText)) {
        toastr.error(`Fitment ${row} needs both a start and end year, or neither.`);
        return;
      }

      let yearStart = null;
      let yearEnd = null;
      if (startText && endText) {
        yearStart = Number(startText);
        yearEnd = Number(endText);
        if (
          !Number.isInteger(yearStart) ||
          !Number.isInteger(yearEnd) ||
          yearStart < 1900 ||
          yearStart > 3000 ||
          yearEnd < 1900 ||
          yearEnd > 3000
        ) {
          toastr.error(`Fitment ${row} needs valid whole-number years between 1900 and 3000.`);
          return;
        }
        if (yearStart > yearEnd) {
          toastr.error(`Fitment ${row} has a start year after its end year.`);
          return;
        }
      }

      const key = `${fitment.makeId}|${yearStart ?? ""}|${yearEnd ?? ""}`;
      if (seenFitments.has(key)) {
        toastr.error(`Fitment ${row} duplicates another fitment.`);
        return;
      }
      seenFitments.add(key);

      normalizedFitments.push({
        makeId: Number(fitment.makeId),
        yearStart,
        yearEnd,
      });
    }

    const saved = await patchAndRefresh({
      categories: categoryIds.map((catagoryId) => ({ catagoryId: Number(catagoryId) })),
      fitments: normalizedFitments,
    });

    if (saved) {
      setRelationsEditing(false);
    }
  };

  const openLocationModal = () => {
    if (saving) return;
    setLocModalOpen(true);
  };

  const handleLocationSave = async (locationId) => {
    await patchAndRefresh({ locationId });
    setLocModalOpen(false);
  };

  const renderYearRange = (start, end) => {
    if (start == null && end == null) return "—";
    if (start === end) return String(start);
    return `${start}–${end}`;
  };

  if (loading) return <div className="apd-skeleton" aria-busy="true" />;
  if (!part) return <p>Not found.</p>;

  const galleryMain = activeImage || vm.image;
  const lightboxImages = [];
  const seenLightboxImages = new Set();

  const addLightboxImage = (src, alt) => {
    if (!src || seenLightboxImages.has(src)) return;
    seenLightboxImages.add(src);
    lightboxImages.push({ src, alt });
  };

  images.forEach((img, imageIndex) => {
    addLightboxImage(
      buildImageUrl(img.url),
      `${vm.name} photo ${imageIndex + 1}`,
    );
  });

  if (galleryMain && !seenLightboxImages.has(galleryMain)) {
    lightboxImages.unshift({ src: galleryMain, alt: vm.name });
  }

  const lightboxStartIndex = Math.max(
    lightboxImages.findIndex((image) => image.src === galleryMain),
    0,
  );
  const isContactOnly = vm.allowsOnlineCheckout === false;

  return (
    <div className="admin-part-details">
      <header className="apd-header">
        <div className="apd-title">
          {edit.name ? (
            <InlineShortText
              value={vm.name}
              maxLength={128}
              disabled={saving}
              onSubmit={(name) => patchAndRefresh({ name })}
              onCancel={() => setEdit((e) => ({ ...e, name: false }))}
            />
          ) : (
            <>
              <h2>{vm.name}</h2>
              <button
                type="button"
                className="apd-btn apd-btn--outlined apd-btn--xs"
                disabled={saving}
                onClick={() => setEdit((e) => ({ ...e, name: true }))}
              >
                Edit Name
              </button>
            </>
          )}
          {vm.availableStatus && (
            <span
              className={`apd-badge ${
                vm.availableStatus === "Available"
                  ? "apd-badge--available"
                  : vm.availableStatus === "Unavailable"
                    ? "apd-badge--unavailable"
                    : vm.availableStatus === "Pending"
                      ? "apd-badge--pending"
                      : ""
              }`}
            >
              {vm.availableStatus}
            </span>
          )}
        </div>

        <div className="admin-part-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onPublishToShopifyClicked}
            disabled={
              isPublishingShopify ||
              !part?.shopifyProductId ||
              isContactOnly
            }
            title={
              isContactOnly
                ? "This item requires a custom shipping quote and must remain Draft in Shopify."
                : ""
            }
          >
            {isPublishingShopify
              ? "Publishing..."
              : isContactOnly
                ? "Contact-Only Item"
                : "Publish to Shopify"}
          </button>

          <button
            type="button"
            className="btn btn-outline-info"
            onClick={onSyncWithShopifyClicked}
            disabled={
              isSyncingShopify ||
              isPublishingShopify ||
              !part?.shopifyProductId
            }
          >
            {isSyncingShopify ? "Syncing..." : "Sync with Shopify"}
          </button>

          <button
            type="button"
            className="btn btn-warning"
            onClick={onUnpublishFromShopifyClicked}
            disabled={isUnpublishingShopify || !part?.shopifyProductId}
          >
            {isUnpublishingShopify
              ? "Unpublishing..."
              : "Unpublish from Shopify"}
          </button>

          <button
            type="button"
            className="btn btn-outline-light"
            onClick={handleSellSimilar}
          >
            Sell Similar
          </button>
        </div>

        {isContactOnly && (
          <div className="apd-admin-contact-only-note" role="note">
            This shipping policy requires a private shipping quote. The Shopify
            product is kept as Draft, and customers are directed to the contact
            form instead of checkout.
          </div>
        )}

        <div className="apd-subtle">
          ID #{vm.id}
          {vm.dateModified
            ? ` • Updated ${new Date(vm.dateModified).toLocaleDateString()}`
            : null}
          {saving ? " • Saving…" : null}
        </div>
      </header>

      <section className="apd-layout">
        <div className="apd-grid">
          <aside className="apd-card apd-media">
            <div className="apd-main-image-container">
              {galleryMain ? (
                <button
                  type="button"
                  className="apd-main-image-button"
                  aria-label={`Open photo viewer for ${vm.name}`}
                  onClick={() => setLightboxOpen(true)}
                >
                  <img src={galleryMain} alt={vm.name} className="apd-photo" />
                </button>
              ) : (
                <div className="apd-photo apd-photo--empty">No Image</div>
              )}
            </div>

            {images.length > 1 && (
              <div className="apd-gallery">
                <div className="apd-gallery__label">Photos</div>
                <div className="apd-thumbs">
                  {images.map((img) => {
                    const src = buildImageUrl(img.url);
                    const key = img.id || img.url;
                    return (
                      <button
                        key={key}
                        type="button"
                        className="apd-thumb"
                        title={img.isPrimary ? "Primary" : ""}
                        onClick={() => setActiveImage(src)}
                      >
                        <img src={src} alt={vm.name} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="apd-actions">
              <button
                type="button"
                className="apd-btn apd-btn--outlined"
                onClick={() => {
                  if (saving) return;
                  const current = vm.rawImage || "";
                  const path = window.prompt("Image path or URL:", current);
                  if (path && path.trim()) {
                    patchAndRefresh({ image: path.trim() });
                  }
                }}
                disabled={saving}
              >
                Replace Photo
              </button>

              <ImageDropZone
                partId={vm.id}
                files={newGalleryFiles}
                onFilesChange={setNewGalleryFiles}
                onUploaded={refreshImages}
                disabled={saving}
                showUploadButton={true}
                title="Upload Gallery (Drag & Drop or Click)"
                helper="Primary image will be the first file."
              />

              <a
                className={`apd-btn ${!galleryMain ? "apd-btn--disabled" : ""}`}
                href={galleryMain || "#"}
                download
                onClick={(e) => {
                  if (!galleryMain) e.preventDefault();
                }}
              >
                Download
              </a>
            </div>
          </aside>

          <article className="apd-card apd-specs">
            <h3>Specs</h3>
            <dl className="apd-dl">
              <div>
                <dt>Part #</dt>
                <dd>
                  {edit.partNumber ? (
                    <InlineShortText
                      value={vm.partNumber || ""}
                      maxLength={128}
                      disabled={saving}
                      onSubmit={(partNumber) => patchAndRefresh({ partNumber })}
                      onCancel={() =>
                        setEdit((e) => ({ ...e, partNumber: false }))
                      }
                    />
                  ) : (
                    <span className="apd-inline-wrap">
                      <span>{vm.partNumber || "—"}</span>
                      <button
                        type="button"
                        className="apd-btn apd-btn--outlined apd-btn--xs"
                        disabled={saving}
                        onClick={() =>
                          setEdit((e) => ({ ...e, partNumber: true }))
                        }
                      >
                        Edit
                      </button>
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt>Brand</dt>
                <dd>
                  {edit.brand ? (
                    <InlineShortText
                      value={vm.brand || ""}
                      maxLength={128}
                      disabled={saving}
                      allowEmpty
                      onSubmit={(brand) => patchAndRefresh({ brand })}
                      onCancel={() =>
                        setEdit((e) => ({ ...e, brand: false }))
                      }
                    />
                  ) : (
                    <span className="apd-inline-wrap">
                      <span>{vm.brand || "—"}</span>
                      <button
                        type="button"
                        className="apd-btn apd-btn--outlined apd-btn--xs"
                        disabled={saving}
                        onClick={() =>
                          setEdit((e) => ({ ...e, brand: true }))
                        }
                      >
                        Edit
                      </button>
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt>Year(s)</dt>
                <dd>{vm.year || "—"}</dd>
              </div>
              <div>
                <dt>Primary Category</dt>
                <dd>{vm.category || "—"}</dd>
              </div>
              <div>
                <dt>Primary Make</dt>
                <dd>{vm.company || "—"}</dd>
              </div>
              <div>
                <dt>Primary Model</dt>
                <dd>{vm.model || "—"}</dd>
              </div>
            </dl>

            <div className="apd-actions">
              <button
                type="button"
                className="apd-btn apd-btn--outlined apd-btn--sm"
                disabled={saving || relationsEditing}
                onClick={beginRelationsEdit}
              >
                Edit Make / Model / Years / Categories
              </button>
            </div>
          </article>

          <article className="apd-card apd-location">
            <h3>Location</h3>
            <dl className="apd-dl">
              <div>
                <dt>Site</dt>
                <dd>{vm.site || "—"}</dd>
              </div>
              <div>
                <dt>Area</dt>
                <dd>{vm.area || "—"}</dd>
              </div>
              <div>
                <dt>Aisle</dt>
                <dd>{vm.aisle || "—"}</dd>
              </div>
              <div>
                <dt>Shelf</dt>
                <dd>{vm.shelf || "—"}</dd>
              </div>
              <div>
                <dt>Section</dt>
                <dd>{vm.section || "—"}</dd>
              </div>
              <div>
                <dt>Box</dt>
                <dd>{vm.box || "—"}</dd>
              </div>
              <div>
                <dt>Last Moved</dt>
                <dd>
                  {vm.dateModified
                    ? new Date(vm.dateModified).toLocaleString()
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Last Moved By</dt>
                <dd>{vm.lastMovedBy || "—"}</dd>
              </div>
            </dl>

            <div className="apd-actions">
              <button
                type="button"
                className="apd-btn apd-btn--outlined"
                onClick={openLocationModal}
                disabled={saving}
              >
                Change Location
              </button>
            </div>

            <div className="apd-other-box-row">
              <dt>Other Box</dt>
              <dd>
                {edit.otherBox ? (
                  <div className="apd-inline">
                    <input
                      type="text"
                      maxLength={100}
                      className="apd-input"
                      defaultValue={vm.otherBox || ""}
                      disabled={saving}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const v = e.currentTarget.value?.trim();
                          patchAndRefresh({ otherBox: v || "" });
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setEdit((s) => ({ ...s, otherBox: false }));
                        }
                      }}
                    />
                    <button
                      className="apd-btn apd-btn--outlined apd-btn--xs"
                      disabled={saving}
                      onClick={(e) => {
                        const input =
                          e.currentTarget.parentElement?.querySelector("input");
                        const v = input?.value?.trim();
                        patchAndRefresh({ otherBox: v || "" });
                      }}
                    >
                      Save
                    </button>
                    <button
                      className="apd-btn apd-btn--outlined apd-btn--xs"
                      disabled={saving}
                      onClick={() =>
                        setEdit((s) => ({ ...s, otherBox: false }))
                      }
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="apd-inline-wrap">
                    <span>{vm.otherBox || "—"}</span>
                    <button
                      className="apd-btn apd-btn--outlined apd-btn--xs"
                      disabled={saving}
                      onClick={() => setEdit((s) => ({ ...s, otherBox: true }))}
                    >
                      Edit
                    </button>
                  </div>
                )}
              </dd>
            </div>
          </article>

          <article className="apd-card apd-relations">
            <div className="apd-relations-header">
              <h3>Compatibility & Categories</h3>
              {!relationsEditing ? (
                <button
                  type="button"
                  className="apd-btn apd-btn--outlined apd-btn--sm"
                  disabled={saving}
                  onClick={beginRelationsEdit}
                >
                  Edit All
                </button>
              ) : null}
            </div>

            {relationsEditing ? (
              <>
                <div className="apd-relations-section">
                  <div className="apd-relations-header">
                    <h4>Categories</h4>
                    <button
                      type="button"
                      className="apd-btn apd-btn--outlined apd-btn--sm"
                      disabled={saving}
                      onClick={addCategoryDraft}
                    >
                      Add Category
                    </button>
                  </div>
                  <p className="apd-subtle">
                    The first row is the primary category. Dragging is not needed;
                    change the first selection to change the primary category.
                  </p>

                  <div className="apd-repeater">
                    {categoryDrafts.map((item, index) => {
                      const takenIds = categoryDrafts
                        .map((draft, draftIndex) =>
                          draftIndex === index ? null : String(draft.catagoryId || ""),
                        )
                        .filter(Boolean);

                      return (
                        <div key={`category-edit-${index}`} className="apd-repeater-row">
                          <label className="apd-editor-label">
                            <span>{index === 0 ? "Primary Category" : `Additional Category ${index}`}</span>
                            <select
                              className="apd-input"
                              value={item.catagoryId}
                              disabled={saving}
                              onChange={(e) => updateCategoryDraft(index, e.target.value)}
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
                          </label>
                          <button
                            type="button"
                            className="apd-btn apd-btn--outlined apd-btn--sm"
                            disabled={saving || categoryDrafts.length <= 1}
                            onClick={() => removeCategoryDraft(index)}
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="apd-relations-section">
                  <div className="apd-relations-header">
                    <h4>Fitments</h4>
                    <button
                      type="button"
                      className="apd-btn apd-btn--outlined apd-btn--sm"
                      disabled={saving}
                      onClick={addFitmentDraft}
                    >
                      Add Fitment
                    </button>
                  </div>
                  <p className="apd-subtle">
                    The first row is the primary make/model and controls the Year(s)
                    shown in Specs. Years are optional, but start and end must be
                    entered together.
                  </p>

                  <div className="apd-repeater">
                    {fitmentDrafts.map((fitment, index) => (
                      <div key={`fitment-edit-${index}`} className="apd-fitment-edit-row">
                        <div className="apd-fitment-edit-heading">
                          {index === 0 ? "Primary Fitment" : `Additional Fitment ${index}`}
                        </div>
                        <div className="apd-fitment-edit-grid">
                          <div className="apd-fitment-edit-selector">
                            <MakeModelSelector
                              idPrefix={`admin-fitment-${index}`}
                              initialMakeId={fitment.makeId || fitment.companyMakeId}
                              initialModelId={fitment.modelId}
                              disabled={saving}
                              onSelectionChange={(selection) =>
                                updateFitmentDraftSelection(index, selection)
                              }
                            />
                          </div>

                          <label className="apd-editor-label">
                            <span>Year Start</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={4}
                              className="apd-input"
                              placeholder="Optional"
                              value={fitment.yearStart}
                              disabled={saving}
                              onChange={(e) =>
                                updateFitmentDraft(index, "yearStart", e.target.value)
                              }
                            />
                          </label>

                          <label className="apd-editor-label">
                            <span>Year End</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={4}
                              className="apd-input"
                              placeholder="Optional"
                              value={fitment.yearEnd}
                              disabled={saving}
                              onChange={(e) =>
                                updateFitmentDraft(index, "yearEnd", e.target.value)
                              }
                            />
                          </label>

                          <button
                            type="button"
                            className="apd-btn apd-btn--outlined apd-btn--sm apd-fitment-edit-remove"
                            disabled={saving || fitmentDrafts.length <= 1}
                            onClick={() => removeFitmentDraft(index)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="apd-actions apd-actions--editor-save">
                  <button
                    type="button"
                    className="apd-btn"
                    disabled={saving}
                    onClick={saveRelations}
                  >
                    {saving ? "Saving..." : "Save Compatibility & Categories"}
                  </button>
                  <button
                    type="button"
                    className="apd-btn apd-btn--outlined"
                    disabled={saving}
                    onClick={() => setRelationsEditing(false)}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="apd-relations-section">
                  <h4>Categories</h4>
                  {vm.categories.length > 0 ? (
                    <div className="apd-chip-list">
                      {vm.categories.map((cat) => (
                        <span
                          key={cat.id || `${cat.catagoryId}-${cat.catagoryName}`}
                          className="apd-chip"
                        >
                          {cat.catagoryName || `Category #${cat.catagoryId}`}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="apd-empty-note">No related categories.</div>
                  )}
                </div>

                <div className="apd-relations-section">
                  <h4>Fitments</h4>
                  {vm.fitments.length > 0 ? (
                    <div className="apd-fitment-list">
                      {vm.fitments.map((fitment) => (
                        <div
                          key={
                            fitment.id ||
                            `${fitment.makeId}-${fitment.modelId}-${fitment.yearStart}-${fitment.yearEnd}`
                          }
                          className="apd-fitment-card"
                        >
                          <div className="apd-fitment-title">
                            {fitment.company || "—"} {fitment.modelName || ""}
                          </div>
                          <div className="apd-subtle">
                            Years: {renderYearRange(fitment.yearStart, fitment.yearEnd)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="apd-empty-note">No related fitments.</div>
                  )}
                </div>
              </>
            )}
          </article>

          <article className="apd-card apd-meta">
            <h3>Meta</h3>
            <dl className="apd-dl">
              <div>
                <dt>Price</dt>
                <dd>
                  {edit.price ? (
                    <InLineNumber
                      value={vm.price}
                      disabled={saving}
                      onSubmit={(n) => patchAndRefresh({ price: n })}
                      onCancel={() => setEdit((e) => ({ ...e, price: false }))}
                    />
                  ) : (
                    <>
                      {fmtPrice(vm.price) || "—"}
                      <button
                        className="apd-btn apd-btn--outlined apd-btn--xs"
                        disabled={saving}
                        onClick={() => setEdit((e) => ({ ...e, price: true }))}
                      >
                        Edit
                      </button>
                    </>
                  )}
                </dd>
              </div>

              <div>
                <dt>Quantity</dt>
                <dd>
                  {edit.quantity ? (
                    <InLineNumber
                      value={vm.quantity ?? 0}
                      step={1}
                      disabled={saving}
                      onSubmit={(n) =>
                        patchAndRefresh({
                          quantity: Math.max(0, Math.trunc(n)),
                        })
                      }
                      onCancel={() =>
                        setEdit((e) => ({ ...e, quantity: false }))
                      }
                    />
                  ) : (
                    <>
                      {Number.isFinite(vm.quantity) ? vm.quantity : "—"}
                      <button
                        className="apd-btn apd-btn--outlined apd-btn--xs"
                        disabled={saving}
                        onClick={() =>
                          setEdit((e) => ({ ...e, quantity: true }))
                        }
                      >
                        Edit
                      </button>
                    </>
                  )}
                </dd>
              </div>

              <div>
                <dt>Condition</dt>
                <dd>
                  {edit.condition ? (
                    <InLineSelect
                      value={String(vm.conditionId ?? "")}
                      options={conditionOptions}
                      disabled={saving}
                      onSubmit={(val) =>
                        patchAndRefresh({ conditionId: Number(val) })
                      }
                      onCancel={() =>
                        setEdit((e) => ({ ...e, condition: false }))
                      }
                    />
                  ) : (
                    <>
                      {vm.conditionName || "—"}
                      <button
                        className="apd-btn apd-btn--outlined apd-btn--xs"
                        disabled={saving}
                        onClick={() =>
                          setEdit((e) => ({ ...e, condition: true }))
                        }
                      >
                        Change
                      </button>
                    </>
                  )}
                </dd>
              </div>

              <div>
                <dt>Shipping Policy</dt>
                <dd>
                  {shippingJob?.isOpen && (
                    <div className="apd-shipping-job-status" role="status">
                      <strong>
                        {shippingJob.status === "AttentionRequired"
                          ? "Shipping update needs attention"
                          : "Shipping update pending"}
                      </strong>
                      <div>
                        Policy {shippingJob.fromPolicyId} → {shippingJob.toPolicyId}
                      </div>
                      <div>
                        {shippingJob.status === "WaitingForShopify"
                          ? "Waiting for Shopify to update its automatic shipping collection."
                          : shippingJob.status === "AttentionRequired"
                            ? "Do not republish or retry; an administrator must review the part."
                            : "Shopify is processing the change in the background."}
                      </div>
                      <small>
                        You can continue other work, navigate away or close this tab.
                        This update will keep running on the server.
                      </small>
                      {shippingJob.lastError && (
                        <small className="apd-shipping-job-error">
                          {shippingJob.lastError}
                        </small>
                      )}
                    </div>
                  )}
                  {shippingJob?.status === "Completed" && (
                    <small className="apd-shipping-job-completed">
                      Last shipping update completed and verified.
                    </small>
                  )}
                  {edit.shippingPolicy ? (
                    <>
                    <InLineSelect
                      value={String(vm.shippingPolicyId ?? "")}
                      options={shippingPolicyOptions}
                      disabled={saving}
                      onSubmit={changeShippingPolicy}
                      onCancel={() =>
                        setEdit((e) => ({ ...e, shippingPolicy: false }))
                      }
                    />
                    {shippingChangeInProgress && (
                      <small role="status" className="apd-shipping-status">
                        Validating and queuing the shipping update…
                      </small>
                    )}
                    </>
                  ) : (
                    <>
                      {vm.shippingPolicyName || "—"}
                      <button
                        className="apd-btn apd-btn--outlined apd-btn--xs"
                        disabled={saving || !!shippingJob?.isOpen}
                        onClick={() =>
                          setEdit((e) => ({ ...e, shippingPolicy: true }))
                        }
                      >
                        Change
                      </button>
                    </>
                  )}
                </dd>
              </div>

              <div>
                <dt>Availability</dt>
                <dd>
                  {edit.availability ? (
                    <InLineSelect
                      value={String(vm.availableId ?? "")}
                      options={availabilityOptions}
                      disabled={saving}
                      onSubmit={(val) =>
                        patchAndRefresh({ availableId: Number(val) })
                      }
                      onCancel={() =>
                        setEdit((e) => ({ ...e, availability: false }))
                      }
                    />
                  ) : (
                    <>
                      {vm.availableStatus || "—"}
                      <button
                        className="apd-btn apd-btn--outlined apd-btn--xs"
                        disabled={saving}
                        onClick={() =>
                          setEdit((e) => ({ ...e, availability: true }))
                        }
                      >
                        Change
                      </button>
                    </>
                  )}
                </dd>
              </div>

              <div>
                <dt>Date Added</dt>
                <dd>
                  {vm.dateCreated
                    ? new Date(vm.dateCreated).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "—"}
                </dd>
              </div>
            </dl>

            <div className="apd-desc">
              <h4>Description</h4>
              {edit.desc ? (
                <InLineText
                  value={vm.description || ""}
                  disabled={saving}
                  onSubmit={(text) => patchAndRefresh({ description: text })}
                  onCancel={() => setEdit((e) => ({ ...e, desc: false }))}
                />
              ) : (
                <>
                  <p className="apd-text">
                    {vm.description || "No description."}
                  </p>
                  <button
                    type="button"
                    className="apd-btn apd-btn--outlined apd-btn--sm"
                    disabled={saving}
                    onClick={() => setEdit((e) => ({ ...e, desc: true }))}
                  >
                    Change Description
                  </button>
                </>
              )}
            </div>

            <div className="apd-desc">
              <h4>Admin Notes</h4>
              {edit.adminNotes ? (
                <InLineText
                  value={vm.adminNotes || ""}
                  disabled={saving}
                  onSubmit={(text) =>
                    patchAndRefresh({ adminNotes: text || "" })
                  }
                  onCancel={() => setEdit((e) => ({ ...e, adminNotes: false }))}
                />
              ) : (
                <>
                  <p className="apd-text">
                    {vm.adminNotes || "No admin notes."}
                  </p>
                  <button
                    type="button"
                    className="apd-btn apd-btn--outlined apd-btn--sm"
                    disabled={saving}
                    onClick={() => setEdit((e) => ({ ...e, adminNotes: true }))}
                  >
                    Change Admin Notes
                  </button>
                </>
              )}
            </div>
          </article>
        </div>

        <aside className="apd-card apd-audit-column">
          <h3>Audit History</h3>
          <AuditHistory
            partId={vm.id}
            pageSize={10}
            refreshToken={auditRefreshToken}
          />
        </aside>
      </section>

      <LocationModal
        open={locModalOpen}
        onClose={() => setLocModalOpen(false)}
        onSave={handleLocationSave}
        initial={initialLocation}
      />

      <PhotoLightbox
        open={lightboxOpen}
        images={lightboxImages}
        startIndex={lightboxStartIndex}
        title={`${vm.name} photos`}
        onClose={() => setLightboxOpen(false)}
        onImageChange={(src) => {
          if (src) setActiveImage(src);
        }}
      />
    </div>
  );
}

export default AdminPartDetails;
