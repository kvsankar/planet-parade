interface HelpButtonProps {
  onClick: () => void
}

export default function HelpButton({ onClick }: HelpButtonProps) {
  return (
    <button className="help-tour-btn" onClick={onClick} title="Take a guided tour">
      ?
    </button>
  )
}
