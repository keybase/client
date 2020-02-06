import * as React from 'react'

export const usePopup = (_ref: React.MutableRefObject<any>, makePopup: () => React.ReactNode) => {
  const [showingPopup, setShowingPopup] = React.useState(false)
  const [popup, setPopup] = React.useState<React.ReactNode>(null)

  React.useEffect(() => {
    if (showingPopup === !popup) {
      setPopup(showingPopup ? makePopup() : null)
    }
  }, [showingPopup, popup, makePopup])

  return {
    popup,
    setShowingPopup,
    showingPopup,
    toggleShowingPopup: () => setShowingPopup(!showingPopup),
  }
}
