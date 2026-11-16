import * as React from 'react'

// Most fs loads finish within a frame or two; showing a spinner for those only flashes.
const loadingShowDelayMs = 1000

// true once `want` has stayed true for delayMs; false again as soon as it goes false
export const useDelayedShow = (want: boolean, delayMs: number = loadingShowDelayMs) => {
  const [shown, setShown] = React.useState(false)
  React.useEffect(() => {
    if (!want) return
    const id = setTimeout(() => setShown(true), delayMs)
    return () => {
      clearTimeout(id)
      setShown(false)
    }
  }, [want, delayMs])
  return want && shown
}
