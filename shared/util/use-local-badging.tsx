import * as React from 'react'
import * as C from '@/constants'

// On a bunch of screens we have 'new' items. We want this behavior
// On click: clear the badges on the server and remove from things like tabs
// Keep a local version of this which is only cleared on navigation blur
const noBadges = new Set<string>()

// share the badged set with rows without prop drilling. Provide `badged` from
// useLocalBadging at the list level, read with useIsNew in rows
export const NewItemsContext = React.createContext<ReadonlySet<string>>(noBadges)
export const useIsNew = (id: string) => React.useContext(NewItemsContext).has(id)

export const useLocalBadging = (storeSet: ReadonlySet<string> | undefined, clearStoreBadges: () => void) => {
  const [badged, setBadged] = React.useState(storeSet?.size ? storeSet : noBadges)

  // keep adding if we got new ones
  const toAdd = [...(storeSet ?? new Set<string>())].filter(n => !badged.has(n))
  if (toAdd.length) {
    setBadged(s => {
      const next = new Set(s)
      toAdd.forEach(a => {
        next.add(a)
      })
      return next
    })
  }

  C.Router2.useSafeFocusEffect(() => {
    clearStoreBadges()
    return () => {
      setBadged(noBadges)
    }
  })

  return {badged}
}
