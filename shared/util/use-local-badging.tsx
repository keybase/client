import * as React from 'react'
import * as C from '@/constants'

// On a bunch of screens we have 'new' items. We want this behavior
// On click: clear the badges on the server and remove from things like tabs
// Keep a local version of this which is only cleared on navigation blur
const noBadges = new Set<string>()
export const useLocalBadging = (storeSet: ReadonlySet<string> | undefined, clearStoreBadges: () => void) => {
  const [badged, setBadged] = React.useState(storeSet?.size ? storeSet : noBadges)

  // keep adding if we got new ones
  const toAdd = [...(storeSet ?? new Set<string>())].reduce((arr, n) => {
    if (!badged.has(n)) {
      arr.push(n)
    }
    return arr
  }, new Array<string>())
  if (toAdd.length) {
    setBadged(s => {
      const next = new Set(s)
      toAdd.forEach(a => {
        next.add(a)
      })
      return next
    })
  }

  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      clearStoreBadges()
      return () => {
        setBadged(noBadges)
      }
    }, [clearStoreBadges])
  )

  return {badged}
}
