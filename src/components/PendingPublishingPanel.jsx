import React, { useState } from "react";
import partsService from "../service/partsService";
import "./pending-publishing.css";

// The client may be adding inventory while this panel is open. Operators
// explicitly select previously created rows; the panel never runs by itself.
export default function PendingPublishingPanel() {
  const [items, setItems] = useState([]);
  const [afterPartId, setAfterPartId] = useState(0);
  const [nextAfter, setNextAfter] = useState(null);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [selected, setSelected] = useState([]);
  const [results, setResults] = useState([]);

  const fetchPage = async (cursor = 0, append = false) => {
    setLoading(true);
    try {
      const data = await partsService.previewPendingShopifyParts(cursor, 20);
      if (data?.readOnly !== true || !Array.isArray(data.items) ||
          data.afterPartId !== cursor) {
        throw new Error("Unexpected pending inventory preview response.");
      }

      setStarted(true);
      setAfterPartId(cursor);
      setNextAfter(data.hasMore ? data.nextAfterPartId : null);
      setItems((previous) => append
        ? [...previous, ...data.items.filter((p) =>
            !previous.some((existing) => existing.partId === p.partId))]
        : data.items);
      if (!append) {
        setSelected([]);
        setResults([]);
      }
    } catch (error) {
      window.alert("Unable to inspect Pending inventory. No products were changed.");
      console.error("Pending preview failed", error);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (partId) =>
    setSelected((previous) => previous.includes(partId)
      ? previous.filter((id) => id !== partId)
      : [...previous, partId]);

  const publishSelected = async () => {
    const candidates = items.filter((item) =>
      selected.includes(item.partId) && item.eligible === true);
    if (candidates.length === 0 || candidates.length > 10) {
      window.alert("Select between 1 and 10 eligible Pending parts.");
      return;
    }

    const approved = window.confirm(
      `Publish these ${candidates.length} Pending parts to Shopify and make them Available once verified?\n\n` +
      candidates.map((part) => `#${part.partId} — ${part.name}`).join("\n") +
      "\n\nConfirm that these parts have finished uploading photos."
    );
    if (!approved) return;

    setPublishing(true);
    const outcome = [];

    try {
      for (const candidate of candidates) {
        try {
          // Existing server endpoint independently checks current SQL policy,
          // Shopify shipping tag/collection, inventory, and publication.
          const response = await partsService.publishShopifyProduct(candidate.partId);
          const published = response?.data?.item;
          if (published?.publishedToOnlineStore === true &&
              String(published.status).toUpperCase() === "ACTIVE") {
            outcome.push({ partId: candidate.partId, status: "Published", message: "" });
          } else {
            outcome.push({ partId: candidate.partId, status: "Review", message: "Shopify publication not confirmed." });
          }
        } catch (error) {
          // Do not blindly retry an uncertain Shopify mutation. The user can
          // inspect this specific part then use its existing Publish button.
          const message = String(
            error?.response?.data?.message || error?.message ||
            "Publication failed; inspect this part before retrying."
          );
          outcome.push({ partId: candidate.partId, status: "Review", message });
        }
      }
    } finally {
      setPublishing(false);
      setResults(outcome);
      setSelected([]);
      // Refresh from SQL: published items should no longer be Pending.
      await fetchPage(0, false);
      setResults(outcome);
    }
  };

  return (
    <section className="pending-pub" aria-label="Review Pending Shopify inventory">
      <h2>Review Pending Shopify Listings</h2>
      <p>
        New checkout parts publish automatically after their photos upload.
        Use this tool only for older Pending parts that are ready to sell.
        It never creates a duplicate Shopify product or publishes contact-only items.
      </p>

      <div className="pending-pub__actions">
        <button type="button" disabled={loading || publishing}
          onClick={() => fetchPage(0, false)}>
          {loading ? "Loading…" : started ? "Refresh Pending" : "Review Pending"}
        </button>
        {started && <span>{items.length} records displayed</span>}
      </div>

      {started && items.length === 0 && <p>No Pending parts found on this page.</p>}

      {items.length > 0 && (
        <>
          <div className="pending-pub__table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Select</th>
                  <th scope="col">Part</th>
                  <th scope="col">Quantity</th>
                  <th scope="col">Status</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {items.map((part) => (
                  <tr key={part.partId}>
                    <td>
                      <input type="checkbox" aria-label={`Select part ${part.partId}`}
                        checked={selected.includes(part.partId)}
                        disabled={!part.eligible || publishing}
                        onChange={() => toggle(part.partId)}/>
                    </td>
                    <td>
                      <strong>#{part.partId}</strong> — {part.name}
                      <small>{part.partNumber}</small>
                    </td>
                    <td>{part.quantity}</td>
                    <td>{part.eligible ? "Eligible" : "Needs review"}</td>
                    <td>
                      <a href={`/admin/part/${part.partId}`}>Open part</a>
                      {!part.eligible && <small>{part.reason}</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pending-pub__actions">
            <button type="button" disabled={publishing || loading || selected.length === 0 || selected.length > 10}
              onClick={publishSelected}>
              {publishing ? "Publishing selected…" : `Publish selected (${selected.length}/10)`}
            </button>
            {nextAfter != null && (
              <button type="button" disabled={publishing || loading}
                onClick={() => fetchPage(nextAfter, true)}>
                Load more Pending parts
              </button>
            )}
          </div>
        </>
      )}

      {results.length > 0 && (
        <div role="status" aria-live="polite">
          <h3>Publication results</h3>
          <ul>
            {results.map((r) => (
              <li key={r.partId}>
                <a href={`/admin/part/${r.partId}`}>Part #{r.partId}</a>: {r.status}
                {r.message ? ` — ${r.message}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
