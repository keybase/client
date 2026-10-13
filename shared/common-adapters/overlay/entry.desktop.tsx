import * as React from 'react'
import {OverlayEntryContext} from './context'
import {
  newEntryId,
  registerEntry,
  unregisterEntry,
  updateEntry,
  type EntryBehavior,
  type EntryStructure,
} from './controller.desktop'

type Props = Omit<EntryStructure, 'parent'> &
  EntryBehavior & {
    // registered only while active
    active?: boolean
  }

// Registers an entry in the overlay stack under the entry it is rendered in. Provide the id as
// OverlayEntryContext to what is inside it.
export const useOverlayEntry = (p: Props) => {
  const {acceptsKeys, active = true, blocking, kind, onEscape, stoppedEscapeCloses, tier} = p
  const parent = React.use(OverlayEntryContext)
  const [id] = React.useState(newEntryId)
  const behaviorRef = React.useRef<EntryBehavior>({acceptsKeys, onEscape, stoppedEscapeCloses})

  React.useLayoutEffect(() => {
    behaviorRef.current = {acceptsKeys, onEscape, stoppedEscapeCloses}
    updateEntry(id, behaviorRef.current)
  })

  React.useLayoutEffect(() => {
    if (!active) {
      return undefined
    }
    registerEntry(id, {blocking, kind, parent, tier}, behaviorRef.current)
    return () => {
      unregisterEntry(id)
    }
  }, [active, blocking, id, kind, parent, tier])

  return id
}
