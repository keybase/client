import * as React from 'react'

// The type parameter (optional) is the type of the component that the popup will be attaching to.
// `popupAnchor` should be passed to that component as its `ref`.
export const usePopup = <T extends React.Component<any>>(
  makePopup: (getAttachmentRef: () => T | null) => React.ReactNode
) => {
  const [showingPopup, setShowingPopup] = React.useState(false)
  const [popup, setPopup] = React.useState<React.ReactNode>(null)
  const popupAnchor = React.useRef<T>(null)

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
    toggleShowingPopup: () => setShowingPopup(!showingPopup),
  }
}
