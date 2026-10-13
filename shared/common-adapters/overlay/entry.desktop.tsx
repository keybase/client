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

type HookProps = Omit<EntryStructure, 'parent'> &
  Omit<EntryBehavior, 'outside' | 'syncAnchor'> &
  Partial<Pick<EntryBehavior, 'outside' | 'syncAnchor'>>

// Registers an entry in the overlay stack under the entry it is rendered in, once `ref` is attached
// to its manual popover, which the stack then shows in its place. Render what is inside only once
// `shown`, and provide `id` to it as OverlayEntryContext.
export const useOverlayEntry = (p: HookProps) => {
  const {acceptsKeys, blocking, kind, onEscape, outside, stoppedEscapeCloses, syncAnchor, tier} = p
  const parent = React.use(OverlayEntryContext)
  const [id] = React.useState(newEntryId)
  const [shown, setShown] = React.useState(false)
  const behavior: EntryBehavior = {acceptsKeys, onEscape, outside, stoppedEscapeCloses, syncAnchor}
  const behaviorRef = React.useRef(behavior)

  React.useLayoutEffect(() => {
    behaviorRef.current = behavior
    updateEntry(id, behavior)
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

// What is inside an entry waits here while it loads (a lazy route screen), so the entry stays shown.
// A Suspense outside would hide and unregister the entry, then mount the content before the entry was
// shown again, where nothing can take focus.
export const EntryContent = (p: {children: React.ReactNode}) => <React.Suspense>{p.children}</React.Suspense>

type Props = HookProps & {
  children: React.ReactNode
  // only what is inside takes clicks, so what is under it stays usable
  passthrough?: boolean
}

// A full-window overlay in the top layer, in its place in the overlay stack.
export const OverlayEntry = (p: Props) => {
  const {acceptsKeys, blocking, children, kind, onEscape, outside, passthrough, stoppedEscapeCloses, tier} = p
  const {id, ref, shown} = useOverlayEntry({
    acceptsKeys,
    blocking,
    kind,
    onEscape,
    outside,
    stoppedEscapeCloses,
    tier,
  })
  const host = document.getElementById('modal-root')
  return host
    ? ReactDOM.createPortal(
        <div
          popover="manual"
          ref={ref}
          data-overlay-entry={id}
          className={passthrough ? 'overlay-entry overlay-entry-passthrough' : 'overlay-entry'}
          tabIndex={-1}
        >
          {shown ? (
            <OverlayEntryContext value={id}>
              <EntryContent>{children}</EntryContent>
            </OverlayEntryContext>
          ) : null}
        </div>,
        host
      )
    : null
}
