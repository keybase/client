import * as React from 'react'
import {usePrevious} from '../util/container'

// The type parameter (optional) is the type of the component that the popup will be attaching to.
// `popupAnchor` should be passed to that component as its `ref`.
export const usePopup = <T extends React.Component<any>>(
  makePopup: (getAttachmentRef: () => T | null) => React.ReactNode,
  extraData?: any // recreates popup if this changes
) => {
  const [showingPopup, setShowingPopup] = React.useState(false)
  const [popup, setPopup] = React.useState<React.ReactNode>(null)
  const popupAnchor = React.useRef<T>(null)
  const prevExtraData = usePrevious(extraData)

  React.useEffect(() => {
    if (showingPopup === !popup || extraData !== prevExtraData) {
      setPopup(showingPopup ? makePopup(() => popupAnchor.current) : null)
    }
  }, [showingPopup, popup, makePopup, extraData, prevExtraData])

  return {
    popup,
    popupAnchor,
    setShowingPopup,
    showingPopup,
    toggleShowingPopup: () => setShowingPopup(!showingPopup),
  }
}
