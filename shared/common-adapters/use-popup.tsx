import * as React from 'react'

export type Popup2Parms = {
  attachTo: () => React.Component | null
  toggleShowingPopup: () => void
}
export const usePopup2 = (makePopup: (p: Popup2Parms) => React.ReactElement | null) => {
  const [showingPopup, setShowingPopup] = React.useState(false)
  const wasShowingPopupRef = React.useRef(false)
  const wasMakePopupRef = React.useRef<(p: Popup2Parms) => React.ReactElement | null>(makePopup)
  const [popup, setPopup] = React.useState<React.ReactNode>(null)
  const popupAnchor = React.useRef<React.Component | null>(null)
  const attachTo = React.useCallback(() => popupAnchor.current, [popupAnchor])

  const toggleShowingPopup = React.useCallback(() => {
    setShowingPopup(s => !s)
  }, [setShowingPopup])

  if (showingPopup !== wasShowingPopupRef.current || makePopup !== wasMakePopupRef.current) {
    wasShowingPopupRef.current = showingPopup
    wasMakePopupRef.current = makePopup
    setPopup(showingPopup ? makePopup({attachTo, toggleShowingPopup}) : null)
  }

  return {
    popup,
    popupAnchor,
    setShowingPopup,
    showingPopup,
    toggleShowingPopup,
  }
}
