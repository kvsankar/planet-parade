interface TabSelectorProps {
  tabs: number[]
  activeTab: number
  onChange: (tab: number) => void
}

export default function TabSelector({ tabs, activeTab, onChange }: TabSelectorProps) {
  if (tabs.length <= 1) return null
  return (
    <div className="chart-tab-selector">
      {tabs.map((k) => (
        <button
          key={k}
          className={`chart-tab-btn ${activeTab === k ? 'active' : ''}`}
          onClick={() => onChange(k)}
        >
          {k}
        </button>
      ))}
    </div>
  )
}
