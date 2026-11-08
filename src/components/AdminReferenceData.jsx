import React, { useEffect, useMemo, useState } from "react";
import toastr from "toastr";
import catagoryService from "../service/catagoryService";
import makeService from "../service/makeService";
import modelService from "../service/modelService";
import loginService from "../service/loginService";
import referenceDeletionService from "../service/referenceDeletionService";
import "./AdminReferenceData.css";

const getApiMessage = (error, fallback) =>
  error?.response?.data?.errors?.[0] ||
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  fallback;

function AdminReferenceData() {
  const [categories, setCategories] = useState([]);
  const [makeRows, setMakeRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingMakeModel, setSavingMakeModel] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [company, setCompany] = useState("");
  const [modelName, setModelName] = useState("");
  const [models, setModels] = useState([]);
  const [canDelete, setCanDelete] = useState(false);
  const [deletion, setDeletion] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const beginDelete = async (kind, target, label) => {
    setDeleting(true);
    try {
      const response = await referenceDeletionService.preview(kind, target);
      setDeletion({ kind, target, label, ...response.item });
    } catch (error) {
      toastr.error(getApiMessage(error, "Unable to check dependencies."));
    } finally { setDeleting(false); }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await referenceDeletionService.remove(deletion.kind, deletion.target);
      setDeletion(null);
      toastr.success("Reference deleted. Inventory was preserved.");
      await loadReferenceData();
    } catch (error) {
      if (error?.response?.data?.item) {
        setDeletion((previous) => ({ ...previous, ...error.response.data.item }));
      }
      toastr.error(getApiMessage(error, "Deletion failed."));
    } finally { setDeleting(false); }
  };

  const deleteButton = (kind, target, label) => canDelete && (
    <button className="admin-reference-delete" type="button" disabled={loading || deleting}
      aria-label={`Delete ${label}`} onClick={() => beginDelete(kind, target, label)}>
      Delete
    </button>
  );

  const loadReferenceData = async () => {
    setLoading(true);

    try {
      const emptyIfMissing = (promise) => promise.catch((error) => {
        if (error?.response?.status === 404) return { item: [] };
        throw error;
      });
      const [categoryResponse, makesResponse, modelResponse] = await Promise.all([
        emptyIfMissing(catagoryService.getAllCatagories()),
        emptyIfMissing(makeService.getAllMakes()),
        emptyIfMissing(modelService.getAllModels()),
      ]);

      setCategories(categoryResponse?.item || []);
      setMakeRows(makesResponse?.item || []);
      setModels(modelResponse?.item || []);
    } catch (error) {
      console.error("Reference data load failed", error);
      toastr.error(getApiMessage(error, "Failed to load catalog reference data."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReferenceData();
    loginService.getCurrentUser().then((response) => {
      const user = response?.item;
      setCanDelete(String(user?.roleName || user?.role?.name || "").replace(/\s/g, "").toLowerCase() === "adminhigh");
    }).catch(() => setCanDelete(false));
  }, []);

  const companies = useMemo(() => {
    const unique = new Map();

    makeRows.forEach((row) => {
      const name = String(row?.company || "").trim();
      if (name && !unique.has(name.toLowerCase())) {
        unique.set(name.toLowerCase(), name);
      }
    });

    return Array.from(unique.values());
  }, [makeRows]);

  const groupedMakes = useMemo(() => {
    const groups = new Map();

    makeRows.forEach((row) => {
      const companyName = String(row?.company || "").trim();
      const model = String(row?.model?.name || row?.modelName || "").trim();
      if (!companyName) return;

      if (!groups.has(companyName)) {
        groups.set(companyName, []);
      }

      if (model) {
        groups.get(companyName).push({ id: row.id, name: model });
      }
    });

    return Array.from(groups.entries())
      .map(([companyName, models]) => ({
        company: companyName,
        models,
      }));
  }, [makeRows]);

  const onCategorySubmit = async (event) => {
    event.preventDefault();
    const name = categoryName.trim();

    if (name.length < 2) {
      toastr.error("Category name must be at least 2 characters.");
      return;
    }

    if (categories.some((item) => String(item?.name || "").trim().toLowerCase() === name.toLowerCase())) {
      toastr.error("That category already exists.");
      return;
    }

    setSavingCategory(true);

    try {
      await catagoryService.addCatagory({ name });
      setCategoryName("");
      toastr.success(`Category “${name}” was created.`);
      await loadReferenceData();
    } catch (error) {
      console.error("Category creation failed", error);
      toastr.error(getApiMessage(error, "Failed to create category."));
    } finally {
      setSavingCategory(false);
    }
  };

  const onMakeModelSubmit = async (event) => {
    event.preventDefault();

    const cleanCompany = company.trim();
    const cleanModel = modelName.trim();

    if (cleanCompany.length < 2) {
      toastr.error("Make name must be at least 2 characters.");
      return;
    }

    if (!cleanModel) {
      toastr.error("Model name is required.");
      return;
    }

    const duplicate = makeRows.some((row) => {
      const existingCompany = String(row?.company || "").trim().toLowerCase();
      const existingModel = String(row?.model?.name || row?.modelName || "").trim().toLowerCase();
      return existingCompany === cleanCompany.toLowerCase() && existingModel === cleanModel.toLowerCase();
    });

    if (duplicate) {
      toastr.error("That make/model combination already exists.");
      return;
    }

    setSavingMakeModel(true);

    try {
      await makeService.addMakeModel({
        company: cleanCompany,
        modelName: cleanModel,
      });

      setCompany(cleanCompany);
      setModelName("");
      toastr.success(`${cleanCompany} ${cleanModel} was created.`);
      await loadReferenceData();
    } catch (error) {
      console.error("Make/model creation failed", error);
      toastr.error(getApiMessage(error, "Failed to create make/model."));
    } finally {
      setSavingMakeModel(false);
    }
  };

  return (
    <main className="admin-reference-page" aria-labelledby="admin-reference-title">
      <header className="admin-reference-heading">
        <p className="admin-reference-eyebrow">Administration</p>
        <h1 id="admin-reference-title">Catalog Setup</h1>
        <p>
          Add categories and make/model combinations without a database update.
          New values become available to Add Item, admin editing, and customer filters.
        </p>
      </header>

      <section className="admin-reference-grid">
        <article className="admin-reference-card">
          <div className="admin-reference-card__heading">
            <div>
              <p className="admin-reference-kicker">Categories</p>
              <h2>Add Category</h2>
            </div>
            <span className="admin-reference-count">{categories.length}</span>
          </div>

          <form className="admin-reference-form" onSubmit={onCategorySubmit}>
            <label htmlFor="admin-new-category">Category name</label>
            <div className="admin-reference-form-row">
              <input
                id="admin-new-category"
                type="text"
                value={categoryName}
                maxLength={128}
                disabled={savingCategory}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder="e.g. Cooling System"
              />
              <button type="submit" disabled={savingCategory}>
                {savingCategory ? "Adding…" : "Add Category"}
              </button>
            </div>
          </form>

          <div className="admin-reference-chip-list" aria-label="Existing categories">
            {categories.map((category) => (
              <span className="admin-reference-chip" key={category.id}>
                {category.name}
                {deleteButton("catagories", category.id, `category ${category.name}`)}
              </span>
            ))}
          </div>
        </article>

        <article className="admin-reference-card">
          <div className="admin-reference-card__heading">
            <div>
              <p className="admin-reference-kicker">Compatibility</p>
              <h2>Add Make / Model</h2>
            </div>
            <span className="admin-reference-count">{makeRows.length}</span>
          </div>

          <p className="admin-reference-help">
            Choose an existing make or type a new one, then enter the model exactly
            as it should appear on the site.
          </p>

          <form className="admin-reference-form" onSubmit={onMakeModelSubmit}>
            <div className="admin-reference-fields">
              <label htmlFor="admin-new-make">
                Make
                <input
                  id="admin-new-make"
                  type="text"
                  list="admin-company-options"
                  value={company}
                  maxLength={128}
                  disabled={savingMakeModel}
                  onChange={(event) => setCompany(event.target.value)}
                  placeholder="e.g. Porsche"
                />
              </label>

              <datalist id="admin-company-options">
                {companies.map((companyName) => (
                  <option value={companyName} key={companyName} />
                ))}
              </datalist>

              <label htmlFor="admin-new-model">
                Model
                <input
                  id="admin-new-model"
                  type="text"
                  value={modelName}
                  maxLength={128}
                  disabled={savingMakeModel}
                  onChange={(event) => setModelName(event.target.value)}
                  placeholder="e.g. 992"
                />
              </label>
            </div>

            <button className="admin-reference-submit" type="submit" disabled={savingMakeModel}>
              {savingMakeModel ? "Adding…" : "Add Make / Model"}
            </button>
          </form>
        </article>
      </section>

      <section className="admin-reference-card admin-reference-card--wide">
        <div className="admin-reference-card__heading">
          <div>
            <p className="admin-reference-kicker">Current data</p>
            <h2>Make / Model Directory</h2>
          </div>
          {loading && <span className="admin-reference-loading">Refreshing…</span>}
        </div>

        <div className="admin-reference-directory">
          {groupedMakes.map((group) => (
            <div className="admin-reference-make" key={group.company}>
              <div className="admin-reference-make__header">
                <h3>{group.company}</h3>
                {deleteButton("manufacturer", group.company, `manufacturer ${group.company}`)}
              </div>
              <div className="admin-reference-chip-list">
                {group.models.map((model) => (
                  <span className="admin-reference-chip" key={model.id}>
                    {model.name}
                    {deleteButton("makes", model.id, `${group.company} ${model.name} association`)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      {canDelete && <section className="admin-reference-card">
        <h2>Global model records</h2>
        <p>Global models can be shared by manufacturers. Remove associations first.</p>
        {models.map((model) => <span className="admin-reference-chip" key={model.id}>
          {String(model.name).trim()}
          {deleteButton("models", model.id, `global model ${String(model.name).trim()}`)}
        </span>)}
      </section>}
      {deletion && <div className="reference-delete-backdrop">
        <section className="admin-reference-card reference-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="reference-delete-title">
          <h2 id="reference-delete-title">Delete {deletion.label}?</h2>
          <p>Target records: {deletion.targetRows}. Inventory and Shopify resources will be preserved.</p>
          <dl>{[["Primary parts", deletion.primaryParts], ["Additional categories", deletion.categories],
            ["Additional fitments", deletion.fitments], ["Make associations", deletion.makes],
            ["Discount rules (including historical)", deletion.discountRules]].map(([label, count]) =>
              <React.Fragment key={label}><dt>{label}</dt><dd>{count}</dd></React.Fragment>)}</dl>
          {!deletion.canDelete && <p role="alert">Deletion is blocked. Resolve the references before trying again.</p>}
          <button type="button" disabled={deleting} onClick={() => setDeletion(null)}>Cancel</button>
          <button type="button" disabled={deleting || !deletion.canDelete} onClick={confirmDelete}>
            {deleting ? "Deleting…" : "Confirm deletion"}
          </button>
        </section>
      </div>}
    </main>
  );
}

export default AdminReferenceData;
