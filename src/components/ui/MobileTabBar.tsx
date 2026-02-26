export type MobileTab = 'scene' | 'align' | 'timeline' | 'sky' | 'charts'

const tabs: { id: MobileTab; label: string; icon: string }[] = [
  { id: 'align', label: 'Align', icon: '⊕' },
  { id: 'timeline', label: 'Timeline', icon: '📈' },
  { id: 'scene', label: 'Scene', icon: '🪐' },
  { id: 'sky', label: 'Sky', icon: '🌌' },
  { id: 'charts', label: 'Charts', icon: '◎' },
]

interface MobileTabBarProps {
  activeTab: MobileTab
  onTabChange: (tab: MobileTab) => void
}

export default function MobileTabBar({ activeTab, onTabChange }: MobileTabBarProps) {
  return (
    <nav className="mobile-tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`mobile-tab${activeTab === tab.id ? ' active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className="mobile-tab-icon">{tab.icon}</span>
          <span className="mobile-tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
