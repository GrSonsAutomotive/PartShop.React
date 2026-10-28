import React from "react";

function InLineSelect({ value, options, onSubmit, onCancel, disabled = false }) {
  const [v, setV] = React.useState(value ?? "");
  return (
    <span className="apd-inline">
      <select
        className="apd-input"
        value={v}
        disabled={disabled}
        onChange={(e) => setV(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button className="apd-btn apd-btn--sm" disabled={disabled} onClick={() => onSubmit(v)}>
        Save
      </button>
      <button
        className="apd-btn apd-btn--sm apd-btn--outlined"
        disabled={disabled}
        onClick={onCancel}
      >
        Cancel
      </button>
    </span>
  );
}

export default InLineSelect;
