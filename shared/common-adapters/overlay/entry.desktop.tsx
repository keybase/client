import * as React from 'react'
import ReactDOM from 'react-dom'
import {OverlayEntryContext} from './context'
import {
  entryMounted,
  newEntryId,
  registerEntry,
  unregisterEntry,
  updateEntry,
  updateEntryStructure,
  type EntryBehavior,
  type EntryStructure,
} from './controller.desktop'

type HookProps = Omit<EntryStructure, 'parent'> &
  Omit<EntryBehavior, 'anchoredWithin' | 'closing' | 'outside' | 'syncAnchor'> &
  Partial<Pick<EntryBehavior, 'anchoredWithin' | 'closing' | 'outside' | 'syncAnchor'>>

// Registers an entry in the overlay stack under the entry it is rendered in, once `ref` is attached
// to its element in #modal-root, which the stack then draws in its place. Render what is inside only
// once `shown`, and provide `id` to it as OverlayEntryContext.
export const useOverlayEntry = (p: HookProps) => {
  const {acceptsKeys, anchoredWithin, blocking, closing, kind, onEscape, outside, route} = p
  const {stoppedEscapeCloses, syncAnchor, tier} = p
  const parent = React.use(OverlayEntryContext)
  const [id] = React.useState(newEntryId)
  const [shown, setShown] = React.useState(false)
  const behavior: EntryBehavior = {
    acceptsKeys,
    anchoredWithin,
    closing,
    onEscape,
    outside,
    stoppedEscapeCloses,
    syncAnchor,
  }
  const behaviorRef = React.useRef(behavior)
  const structureRef = React.useRef<EntryStructure>({blocking, kind, parent, route, tier})

  React.useLayoutEffect(() => {
    behaviorRef.current = behavior
    updateEntry(id, behavior)
  })

  // Registered first, then what is inside mounts in a follow-up commit before paint: anything opened
  // from inside registers after this one, so it stacks above it, and its element goes after this one
  // in #modal-root, which CSS anchor positioning needs to anchor it to something in here.
  const ref = React.useCallback(
    (element: HTMLElement | null) => {
      if (!element) {
        return undefined
      }
      registerEntry(id, structureRef.current, behaviorRef.current, element)
      setShown(true)
      return () => {
        unregisterEntry(id)
      }
    },
    [id]
  )

  // Changing what it is (blocking, tier) keeps the entry, its place and what is open from it.
  React.useLayoutEffect(() => {
    structureRef.current = {blocking, kind, parent, route, tier}
    updateEntryStructure(id, structureRef.current)
    if (shown) {
      entryMounted(id)
    }
  }, [blocking, id, kind, parent, route, shown, tier])

  return {id, ref, shown}
}

// What is inside an entry waits here while it loads (a lazy route screen), so the entry stays shown.
// A Suspense outside would hide and unregister the entry, then mount the content before the entry was
// shown again, where nothing can take focus.
const EntryContent = (p: {children: React.ReactNode}) => <React.Suspense>{p.children}</React.Suspense>

type EntryElementProps = {
  id: string
  shown: boolean
  elementRef: React.Ref<HTMLDivElement>
  className: string
  style?: React.CSSProperties
  tabIndex?: number
  // a box around what is inside
  contentClassName?: string
  contentRef?: React.Ref<HTMLDivElement>
  contentStyle?: React.CSSProperties
  // committed with what is inside, ahead of it, so it runs before anything in it does
  beforeContent?: React.ReactNode
  children: React.ReactNode
}

// An entry's element in the modal root, holding what is inside once the stack has it.
export const EntryElement = (p: EntryElementProps) => {
  const {beforeContent, children, className, contentClassName, contentRef, contentStyle, id} = p
  const {elementRef, shown, style, tabIndex} = p
  const host = document.getElementById('modal-root')
  if (!host) {
    return null
  }
  const inside = (
    <EntryContent>
      {beforeContent}
      {children}
    </EntryContent>
  )
  return ReactDOM.createPortal(
    <div
      ref={elementRef}
      data-overlay-entry={id}
      className={className}
      style={style}
      tabIndex={tabIndex}
    >
      {shown ? (
        <OverlayEntryContext value={id}>
          {contentClassName ? (
            <div className={contentClassName} ref={contentRef} style={contentStyle}>
              {inside}
            </div>
          ) : (
            inside
          )}
        </OverlayEntryContext>
      ) : null}
    </div>,
    host
  )
}

type Props = HookProps & {
  children: React.ReactNode
  // only what is inside takes clicks, so what is under it stays usable
  passthrough?: boolean
}

// A full-window overlay, in its place in the overlay stack.
export const OverlayEntry = (p: Props) => {
  const {acceptsKeys, blocking, children, closing, kind, onEscape, outside, passthrough, route} = p
  const {stoppedEscapeCloses, tier} = p
  const {id, ref, shown} = useOverlayEntry({
    acceptsKeys,
    blocking,
    closing,
    kind,
    onEscape,
    outside,
    route,
    stoppedEscapeCloses,
    tier,
  })
  return (
    <EntryElement
      id={id}
      shown={shown}
      elementRef={ref}
      className={passthrough ? 'overlay-entry overlay-entry-passthrough' : 'overlay-entry'}
      tabIndex={-1}
    >
      {children}
    </EntryElement>
  )
}
