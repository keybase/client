import * as React from 'react'
import type {MeasureRef} from './measure-ref'

export type Popup2Parms = {
  attachTo?: React.RefObject<MeasureRef>
  showPopup: () => void
  hidePopup: () => void
}

const tooQuick = 100

export const usePopup2 = (makePopup: (p: Popup2Parms) => React.ReactElement | null) => {
  const [showingPopup, setShowingPopup] = React.useState(false)
  const wasShowingPopupRef = React.useRef(false)
  const wasMakePopupRef = React.useRef<(p: Popup2Parms) => React.ReactElement | null>(makePopup)
  const [popup, setPopup] = React.useState<React.ReactNode>(null)
  const popupAnchor = React.useRef<MeasureRef>(null)
  const attachTo = popupAnchor
  const lastToggle = React.useRef(0)

  const hidePopup = React.useCallback(() => {
    const now = Date.now()
    if (now - lastToggle.current < tooQuick) {
      return
    }
    lastToggle.current = now
    setShowingPopup(false)
  }, [setShowingPopup])
  const showPopup = React.useCallback(() => {
    const now = Date.now()
    if (now - lastToggle.current < tooQuick) {
      return
    }
    lastToggle.current = now
    setShowingPopup(true)
  }, [setShowingPopup])
  const togglePopup = showingPopup ? hidePopup : showPopup

  if (showingPopup !== wasShowingPopupRef.current || makePopup !== wasMakePopupRef.current) {
    wasShowingPopupRef.current = showingPopup
    wasMakePopupRef.current = makePopup
    setPopup(showingPopup ? makePopup({attachTo, hidePopup, showPopup}) : null)
  }

  return {hidePopup, popup, popupAnchor, showPopup, showingPopup, togglePopup}
}
