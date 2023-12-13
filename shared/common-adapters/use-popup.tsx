import * as React from 'react'
import type {MeasureRef} from './measure-ref'

export type Popup2Parms = {
  attachTo?: React.RefObject<MeasureRef>
  toggleShowingPopup: () => void
  hidePopup: () => void
}
export const usePopup2 = (makePopup: (p: Popup2Parms) => React.ReactElement | null) => {
  const [showingPopup, setShowingPopup] = React.useState(false)
  const wasShowingPopupRef = React.useRef(false)
  const wasMakePopupRef = React.useRef<(p: Popup2Parms) => React.ReactElement | null>(makePopup)
  const [popup, setPopup] = React.useState<React.ReactNode>(null)
  const popupAnchor = React.useRef<MeasureRef>(null)
  const attachTo = popupAnchor

  const toggleShowingPopup = React.useCallback(() => {
    setShowingPopup(s => !s)
  }, [setShowingPopup])
  const hidePopup = React.useCallback(() => {
    setShowingPopup(false)
  }, [setShowingPopup])

  if (showingPopup !== wasShowingPopupRef.current || makePopup !== wasMakePopupRef.current) {
    wasShowingPopupRef.current = showingPopup
    wasMakePopupRef.current = makePopup
    setPopup(showingPopup ? makePopup({attachTo, hidePopup, toggleShowingPopup}) : null)
  }

  return {
    hidePopup,
    popup,
    popupAnchor,
    setShowingPopup,
    showingPopup,
    toggleShowingPopup,
  }
}
