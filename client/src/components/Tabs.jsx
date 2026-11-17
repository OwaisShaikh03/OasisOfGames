export default function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs">
      {tabs.map(([key, label]) => (
        <button key={key} className={value === key ? "tab active" : "tab"} onClick={() => onChange(key)}>
          {label}
        </button>
      ))}
    </div>
  );
}