import React, { useEffect, useRef, useState } from "react";
import toastr from "toastr";
import loginService from "../service/loginService";
import partsService from "../service/partsService";
import inventoryCleanupService from "../service/inventoryCleanupService";
import "./InventoryCleanup.css";

const PAGE_SIZE = 20;
const THRESHOLDS = [30, 60, 90, 180, 365];

const errorMessage = (error, fallback) =>
  error?.response?.data?.message ||
  error?.response?.data?.errors?.[0] ||
  error?.response?.data?.error ||
  fallback;

const formatDate = (value) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString();
};

const imageSource = (url) => {
  if (!url || !/^\/uploads\/items\/[^/]+$/.test(url)) return null;
  return partsService.partImageUrl.replace(/\/$/, "") + url;
};

function InventoryCleanup() {
  const [adminHigh, setAdminHigh] = useState(null);
  const [query, setQuery] = useState("");
  const [olderThanDays, setOlderThanDays] = useState(90);
  const [pageIndex, setPageIndex] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [part, setPart] = useState(null);
  const [images, setImages] = useState([]);
  const [eligibility, setEligibility] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmedId, setConfirmedId] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const selectionRequest = useRef(0);

  useEffect(() => {
    let active = true;
    loginService.getCurrentUser().then((response) => {
      if (!active) return;
      const user = response?.item;
      const role = String(user?.roleName || user?.role?.name || "")
        .replace(/\s/g, "").toLowerCase();
      setAdminHigh(role === "adminhigh");
    }).catch(() => { if (active) setAdminHigh(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!adminHigh) return undefined;
    let active = true;
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await inventoryCleanupService.search({
          query: query.trim(), olderThanDays, pageIndex, pageSize: PAGE_SIZE
        });
        if (!active) return;
        setRows(response?.item?.rows || []);
        setTotalCount(response?.item?.totalCount || 0);
        setSearchError("");
      } catch (error) {
        if (!active) return;
        setRows([]);
        setTotalCount(0);
        setSearchError(errorMessage(error, "Unable to load unavailable inventory."));
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [adminHigh, query, olderThanDays, pageIndex, reloadToken]);

  const selectPart = async (id) => {
    const request = ++selectionRequest.current;
    setSelectedId(id);
    setPart(null);
    setImages([]);
    setEligibility(null);
    setDetailError("");
    setModalOpen(false);
    setConfirmedId("");
    setDetailLoading(true);
    try {
      const [partResult, imageResult, previewResult] = await Promise.all([
        partsService.getPartById(id),
        partsService.getPartImagesByPartId(id),
        inventoryCleanupService.preview(id),
      ]);
      if (request !== selectionRequest.current) return;
      setPart(partResult?.item || null);
      setImages(Array.isArray(imageResult?.item) ? imageResult.item : []);
      setEligibility(previewResult?.item || null);
    } catch (error) {
      if (request !== selectionRequest.current) return;
      setDetailError(errorMessage(error, "Unable to load this part's details."));
    } finally {
      if (request === selectionRequest.current) setDetailLoading(false);
    }
  };

  const clearSelection = () => {
    selectionRequest.current += 1;
    setSelectedId(null);
    setPart(null);
    setImages([]);
    setEligibility(null);
    setDetailError("");
    setDetailLoading(false);
    setModalOpen(false);
    setConfirmedId("");
  };

  const confirmDelete = async (event) => {
    event.preventDefault();
    if (!part || !eligibility?.canDelete || confirmedId !== String(selectedId)) return;
    setDeleting(true);
    try {
      const response = await inventoryCleanupService.deletePart(selectedId, Number(confirmedId));
      const message = response?.item?.message || "Listing deleted.";
      if (response?.item?.photoCleanupPending > 0) toastr.warning(message);
      else toastr.success(message);
      clearSelection();
      setReloadToken((token) => token + 1);
    } catch (error) {
      toastr.error(errorMessage(error, "Unable to delete this listing."));
      setModalOpen(false);
      setConfirmedId("");
      if (selectedId != null) {
        try {
          const response = await inventoryCleanupService.preview(selectedId);
          setEligibility(response?.item || null);
        } catch { /* A subsequent search can refresh the listing. */ }
      }
    } finally {
      setDeleting(false);
    }
  };

  const retryPhotos = async () => {
    setRetrying(true);
    try {
      const response = await inventoryCleanupService.retryPhotoCleanup();
      const item = response?.item;
      toastr.info("Photo cleanup: " + (item?.deleted ?? 0) +
        " removed, " + (item?.pending ?? 0) + " still requiring attention.");
    } catch (error) {
      toastr.error(errorMessage(error, "Unable to retry photo cleanup."));
    } finally {
      setRetrying(false);
    }
  };

  const firstPhotoUrl = images.find((image) => image?.isPrimary)?.url ||
    images[0]?.url || part?.image;
  const primaryImage = imageSource(firstPhotoUrl);
  const location = part?.location;
  const locationText = [
    location?.site?.name, location?.area?.name, location?.aisle?.name,
    location?.shelf?.name, location?.section?.name, location?.box?.name
  ].filter(Boolean).join(" / ");

  if (adminHigh === null) {
    return <main className="ic-page"><p>Checking administrator permissions...</p></main>;
  }
  if (!adminHigh) {
    return <main className="ic-page"><h1>Inventory Cleanup</h1>
      <p>You must be signed in as AdminHigh to use inventory cleanup.</p></main>;
  }

  return (
    <main className="ic-page">
      <header className="ic-heading">
        <div>
          <p className="ic-eyebrow">Administration / Inventory</p>
          <h1>Inventory Cleanup</h1>
          <p>Review unavailable listings by oldest last modification. Delete one eligible listing at a time.</p>
        </div>
        <button type="button" className="ic-button ic-button-secondary"
          onClick={retryPhotos} disabled={retrying}>
          {retrying ? "Retrying..." : "Retry photo cleanup"}
        </button>
      </header>
      <div className="ic-grid">
        <section className="ic-panel ic-list-panel" aria-label="Unavailable parts">
          <h2>Unavailable Parts</h2>
          <label htmlFor="ic-search">Search by name, part number or Part ID</label>
          <input id="ic-search" value={query} placeholder="Search unavailable parts"
            onChange={(event) => { setQuery(event.target.value); setPageIndex(0); }} />
          <label htmlFor="ic-age">Unavailable for at least</label>
          <select id="ic-age" value={olderThanDays}
            onChange={(event) => { setOlderThanDays(Number(event.target.value)); setPageIndex(0); }}>
            {THRESHOLDS.map((days) =>
              <option key={days} value={days}>{days}+ days ago</option>)}
          </select>
          <p className="ic-meta">
            {searchLoading ? "Loading..." : totalCount + " matching parts"}
            <span>Oldest first</span>
          </p>
          {searchError && <p role="alert" className="ic-error">{searchError}</p>}
          <div className="ic-results">
            {!searchLoading && !rows.length && !searchError && (
              <div className="ic-empty-list">No unavailable parts match these filters.</div>
            )}
            {rows.map((row) => (
              <button key={row.id} type="button"
                className={"ic-result" + (selectedId === row.id ? " ic-result-selected" : "")}
                onClick={() => selectPart(row.id)}
                aria-pressed={selectedId === row.id}>
                <strong>{row.name}</strong>
                <small>#{row.id} · {row.partNumber || "No part number"}</small>
                <small>Modified {formatDate(row.lastModified)} · Unavailable {row.daysUnavailable} days</small>
                {row.shopifyLinked && <small className="ic-muted">Linked to Shopify</small>}
              </button>
            ))}
          </div>
          <nav className="ic-pagination" aria-label="Part result pagination">
            <button type="button" disabled={searchLoading || pageIndex === 0}
              onClick={() => setPageIndex((index) => Math.max(0, index - 1))}>Previous</button>
            <span>Page {pageIndex + 1} of {Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}</span>
            <button type="button" disabled={searchLoading || (pageIndex + 1) * PAGE_SIZE >= totalCount}
              onClick={() => setPageIndex((index) => index + 1)}>Next</button>
          </nav>
        </section>
        <section className="ic-panel ic-detail-panel" aria-label="Selected part details">
          {selectedId === null ? (
            <div className="ic-empty-detail">
              <div className="ic-empty-icon" aria-hidden="true">▢</div>
              <h2>No part selected</h2>
              <p>Select a part on the left to inspect it here.</p>
            </div>
          ) : detailLoading ? (
            <p>Loading part #{selectedId}...</p>
          ) : detailError ? (
            <div>
              <p className="ic-error" role="alert">{detailError}</p>
              <button type="button" className="ic-button" onClick={() => selectPart(selectedId)}>Retry</button>
            </div>
          ) : part ? (
            <div className="ic-detail-content">
              <div className="ic-detail-header">
                <div><p className="ic-eyebrow">Selected listing #{selectedId}</p>
                  <h2>{part.name}</h2></div>
                <span className="ic-status">Unavailable</span>
              </div>
              <div className="ic-photo">
                {primaryImage ? <img src={primaryImage} alt={part.name + " listing"} /> :
                  <span>Image unavailable</span>}
              </div>
              <dl className="ic-facts">
                <div><dt>Part ID</dt><dd>{selectedId}</dd></div>
                <div><dt>Part number</dt><dd>{part.partNumber || "—"}</dd></div>
                <div><dt>Last modified</dt><dd>{formatDate(eligibility?.lastModified || part.dateModified || part.datemodified)}</dd></div>
                <div><dt>Unavailable since</dt><dd>{formatDate(eligibility?.unavailableSince)}</dd></div>
                <div><dt>Days unavailable</dt><dd>{eligibility?.daysUnavailable ?? "—"}</dd></div>
                <div><dt>Stored photos</dt><dd>{images.length}</dd></div>
                {eligibility?.shopifyLinked && <>
                  <div><dt>Shopify product ID</dt><dd>{eligibility.shopify?.shopifyProductId || part.shopifyProductId || "—"}</dd></div>
                  <div><dt>Shopify product status</dt><dd>{eligibility.shopify?.shopifyProductStatus || "Not verified"}</dd></div>
                  <div><dt>Verified Shopify store</dt><dd>{eligibility.shopify?.shopDomain || "Not authorized"}</dd></div>
                  <div><dt>Cleanup operation</dt><dd>{eligibility.shopify?.operationState || "Not started"}</dd></div>
                </>}
                <div><dt>Quantity</dt><dd>{part.quantity ?? "—"}</dd></div>
                <div><dt>Brand</dt><dd>{part.brand || "—"}</dd></div>
                <div><dt>Location</dt><dd>{locationText || part.otherBox || "Not set"}</dd></div>
              </dl>
              {eligibility && (
                <p className={eligibility.canDelete ? "ic-eligible" : "ic-warning"}>
                  {eligibility.canDelete
                    ? (eligibility.shopifyLinked
                        ? "Eligible for coordinated Shopify + SQL deletion. " + (eligibility.reason || "")
                        : "Eligible for permanent deletion (minimum 90 days).")
                    : "Deletion unavailable: " + eligibility.reason}
                </p>
              )}
              <div className="ic-actions">
                <a className="ic-button ic-button-secondary" href={"/admin/part/" + selectedId}
                  target="_blank" rel="noopener noreferrer">View Full Details ↗</a>
                <button type="button" className="ic-button ic-button-danger"
                  disabled={!eligibility?.canDelete || deleting}
                  onClick={() => { setConfirmedId(""); setModalOpen(true); }}>Delete Part</button>
              </div>
            </div>
          ) : <p>Part details unavailable.</p>}
        </section>
      </div>
      {modalOpen && part && (
        <div className="ic-modal-backdrop" onMouseDown={(event) => {
          if (event.currentTarget === event.target && !deleting) setModalOpen(false);
        }}>
          <div className="ic-modal" role="dialog" aria-modal="true"
            aria-labelledby="ic-modal-title" aria-describedby="ic-modal-description">
            <h2 id="ic-modal-title">Permanently delete part?</h2>
            <p id="ic-modal-description">This will delete <strong>{part.name}</strong> (Part ID {selectedId})
              {eligibility?.shopifyLinked
                ? " and its matching Shopify product from the verified store "
                : ""}{eligibility?.shopifyLinked ? (eligibility?.shopify?.shopDomain || "") : ""}
              and queue its unshared uploaded photographs for removal. This cannot be undone.</p>
            <form onSubmit={confirmDelete}>
              <label htmlFor="ic-confirm-id">Type Part ID {selectedId} to confirm</label>
              <input id="ic-confirm-id" autoFocus inputMode="numeric" value={confirmedId}
                onChange={(event) => setConfirmedId(event.target.value.replace(/\D/g, ""))}
                autoComplete="off" />
              <div className="ic-actions">
                <button type="button" className="ic-button ic-button-secondary"
                  onClick={() => { setModalOpen(false); setConfirmedId(""); }}
                  disabled={deleting}>Cancel</button>
                <button type="submit" className="ic-button ic-button-danger"
                  disabled={deleting || confirmedId !== String(selectedId)}>
                  {deleting ? "Deleting..." : "Confirm Permanent Delete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default InventoryCleanup;
