import * as React from 'react'
import ReactDOM from 'react-dom'
import {OverlayEntryContext} from './context'
import {
  entryMounted,
  newEntryId,
  registerEntry,
  unregisterEntry,
  updateEntry,
  type EntryBehavior,
  type EntryStructure,
} from './controller.desktop'

type HookProps = Omit<EntryStructure, 'parent'> & EntryBehavior

// Registers an entry in the overlay stack under the entry it is rendered in, once `ref` is attached
// to its manual popover, which the stack then shows in its place. Render what is inside only once
// `shown`, and provide `id` to it as OverlayEntryContext.
export const useOverlayEntry = (p: HookProps) => {
  const {acceptsKeys, blocking, kind, onEscape, stoppedEscapeCloses, tier} = p
  const parent = React.use(OverlayEntryContext)
  const [id] = React.useState(newEntryId)
  const [shown, setShown] = React.useState(false)
  const behaviorRef = React.useRef<EntryBehavior>({acceptsKeys, onEscape, stoppedEscapeCloses})

  React.useLayoutEffect(() => {
    behaviorRef.current = {acceptsKeys, onEscape, stoppedEscapeCloses}
    updateEntry(id, behaviorRef.current)
  })

  // Shown first, then what is inside mounts in a follow-up commit before paint: focusing on mount
  // works, and anything opened from inside registers after this one, so it stacks above it.
  const ref = React.useCallback(
    (element: HTMLElement | null) => {
      if (!element) {
        return undefined
      }
      registerEntry(id, {blocking, kind, parent, tier}, behaviorRef.current, element)
      setShown(true)
      return () => {
        unregisterEntry(id)
      }
    },
    [blocking, id, kind, parent, tier]
  )

  React.useLayoutEffect(() => {
    if (shown) {
      entryMounted(id)
    }
  }, [id, shown])

  return {id, ref, shown}
}

type Props = HookProps & {
  children: React.ReactNode
}

// A full-window overlay in the top layer, in its place in the overlay stack.
export const OverlayEntry = (p: Props) => {
  const {acceptsKeys, blocking, children, kind, onEscape, stoppedEscapeCloses, tier} = p
  const {id, ref, shown} = useOverlayEntry({acceptsKeys, blocking, kind, onEscape, stoppedEscapeCloses, tier})
  const host = document.getElementById('modal-root')
  return host
    ? ReactDOM.createPortal(
        <div
          popover="manual"
          ref={ref}
          data-overlay-entry={id}
          className="overlay-entry"
          tabIndex={-1}
        >
          {shown ? <OverlayEntryContext value={id}>{children}</OverlayEntryContext> : null}
        </div>,
        host
      )
    : null
}
