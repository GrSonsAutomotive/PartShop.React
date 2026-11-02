import React from "react";
import { useNavigate } from "react-router-dom";
import "./admin-actions.css";
import PendingPublishingPanel from "./PendingPublishingPanel";

const AddPartIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const RefundIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 7H5v-4" />
    <path d="M5.5 7.5A8 8 0 1 1 4 14" />
    <path d="M12 8v8" />
    <path d="M15 10.25c0-1.15-1.34-2.08-3-2.08s-3 .93-3 2.08 1.34 2.08 3 2.08 3 .93 3 2.08-1.34 2.08-3 2.08-3-.93-3-2.08" />
  </svg>
);

const DiscountIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 13.5 13.5 20a2.12 2.12 0 0 1-3 0L4 13.5V4h9.5L20 10.5a2.12 2.12 0 0 1 0 3Z" />
    <circle cx="9" cy="9" r="1.25" />
    <path d="m9 15 6-6" />
    <circle cx="15" cy="15" r="1.25" />
  </svg>
);

const LocateIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
    <path d="M11 8v6M8 11h6" />
  </svg>
);

const OrdersIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 3h12v18H6z" />
    <path d="M9 7h6M9 11h6M9 15h4" />
    <path d="M9 3v2M15 3v2" />
  </svg>
);


const CatalogIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 5h16v14H4z" />
    <path d="M8 9h8M8 13h5" />
    <path d="M18 3v4M6 3v4" />
  </svg>
);

const ACTIONS = [
  {
    key: "add",
    title: "Add New Part",
    description: "Create a new inventory listing and prepare it for Shopify.",
    buttonText: "Add",
    route: "/admin/add",
    icon: AddPartIcon,
  },
  {
    key: "refunds",
    title: "Refund Requests",
    description: "Review customer return requests and refund activity.",
    buttonText: "Review",
    route: "/admin/refunds",
    icon: RefundIcon,
  },
  {
    key: "discounts",
    title: "Discount Codes",
    description: "Create, publish, review, and deactivate discount codes.",
    buttonText: "Manage",
    route: "/admin/discounts",
    icon: DiscountIcon,
  },
  {
    key: "catalog",
    title: "Catalog Setup",
    description: "Add categories and make/model combinations used throughout the site.",
    buttonText: "Manage",
    route: "/admin/catalog-setup",
    icon: CatalogIcon,
  },
  {
    key: "locate",
    title: "Locate Part",
    description: "Search inventory and find the current warehouse location.",
    buttonText: "Locate",
    route: "/Admin/Search",
    icon: LocateIcon,
  },
  {
    key: "orders",
    title: "Orders",
    description: "View Shopify orders, item details, and pick information.",
    buttonText: "View",
    route: "/Admin/Orders",
    icon: OrdersIcon,
  },
];

function AdminActions() {
  const navigate = useNavigate();

  return (
    <main className="admin-actions-page" aria-labelledby="admin-actions-title">
      <header className="admin-actions-heading">
        <p className="admin-actions-eyebrow">Administration</p>
        <h1 id="admin-actions-title">Admin Action Panel</h1>
        <p>Choose an inventory, catalog, order, discount, or refund workflow.</p>
      </header>

      <section className="action-container" aria-label="Admin actions">
        {ACTIONS.map((action) => {
          const Icon = action.icon;

          return (
            <article className="admin-action" key={action.key}>
              <div className="admin-action__icon">
                <Icon />
              </div>

              <div className="admin-action__content">
                <h2>{action.title}</h2>
                <p>{action.description}</p>
              </div>

              <button
                type="button"
                className="admin-button"
                onClick={() => navigate(action.route)}
              >
                {action.buttonText}
              </button>
            </article>
          );
        })}
      </section>
      <PendingPublishingPanel />
    </main>
  );
}

export default AdminActions;
