import * as React from 'react'

// The type parameter (optional) is the type of the component that the popup will be attaching to.
// `popupAnchor` should be passed to that component as its `ref`.
// deprecated. Adds extra useEffects and won't update the popup if any dependencies change, better to use
// usePopup2 with a React.useCallback(makePopup)
export const usePopup = <T extends React.Component<any>>(
  makePopup: (getAttachmentRef: () => T | null) => React.ReactNode
) => {
  const [showingPopup, setShowingPopup] = React.useState(false)
  const [popup, setPopup] = React.useState<React.ReactNode>(null)
  const popupAnchor = React.useRef<T | null>(null)

  const toggleShowingPopup = React.useCallback(() => {
    setShowingPopup(s => !s)
  }, [setShowingPopup])

  React.useEffect(() => {
    if (showingPopup === !popup) {
      setPopup(showingPopup ? makePopup(() => popupAnchor.current) : null)
    }
  }, [showingPopup, popup, makePopup])

  return {
    popup,
    popupAnchor,
    setShowingPopup,
    showingPopup,
    toggleShowingPopup,
  }
}

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
