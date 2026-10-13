import * as React from 'react'
import * as Styles from '@/styles'
import ReactDOM from 'react-dom'
import type {MeasureRef} from '../../measure-ref'
import {OverlayEntryContext} from '../../overlay/context'
import {setEntryDormant} from '../../overlay/controller.desktop'
import {EntryContent, useOverlayEntry} from '../../overlay/entry.desktop'
import {
  heightVar,
  heldLeftVar,
  heldTopVar,
  heldWidthVar,
  offsetVar,
  popupMaxWidth,
  popupPlacement,
  widthVar,
} from './placement.desktop'

type ModalPositionRelativeProps = {
  attachTo?: React.RefObject<MeasureRef | null>
  position: Styles.Position
  positionFallbacks?: ReadonlyArray<Styles.Position>
  matchDimension?: boolean
  // with none it is a passive popup, like a tooltip: no Escape, and clicks outside leave it open
  onHidden?: () => void
  propagateOutsideClicks?: boolean
  style?: Styles.StylesCrossPlatform
  children: React.ReactNode
  disableEscapeKey?: boolean // if true, ignore keys
  offset?: number // offset in pixels from edge
}

// anchor-name takes a list, so one element can anchor several popups
const setAnchorName = (element: HTMLElement | null | undefined, name: string, on: boolean) => {
  if (!element) {
    return
  }
  const names = element.style.getPropertyValue('anchor-name').split(',').map(n => n.trim())
  const next = names.filter(n => n && n !== name)
  if (on) {
    next.push(name)
  }
  if (next.length) {
    element.style.setProperty('anchor-name', next.join(', '))
  } else {
    element.style.removeProperty('anchor-name')
  }
}

const ancestorsOf = (element: Element) => {
  const path: Array<Element> = []
  for (let e: Element | null = element; e; e = e.parentElement) {
    path.push(e)
  }
  return path
}

const setSize = (popup: HTMLElement, width: number, height: number) => {
  popup.style.setProperty(widthVar, `${width}px`)
  popup.style.setProperty(heightVar, `${height}px`)
  popup.removeAttribute('data-unsized')
}

export const RelativeFloatingBox = (props: ModalPositionRelativeProps) => {
  const {attachTo, children, propagateOutsideClicks, onHidden, style} = props
  const {position, matchDimension = false, positionFallbacks, disableEscapeKey, offset = 0} = props
  const popupRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  // undefined until the first check, so a popup with nothing to anchor to starts hidden
  const anchorRef = React.useRef<HTMLElement | null | undefined>(undefined)
  const anchorObserverRef = React.useRef<ResizeObserver | null>(null)
  // where the popup last was while its anchor was rendered
  // the anchor and everything it was in, when it was last there
  const anchorPathRef = React.useRef<ReadonlyArray<Element>>([])
  const lastPlaceRef = React.useRef<{left: number; top: number; width: number} | undefined>(undefined)
  const anchorName = `--kb-anchor-${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const placement = popupPlacement(position, matchDimension, positionFallbacks)

  // The anchor can be replaced, removed or hidden without this re-rendering, e.g. a list row
  // re-rendering on its own, or a hover toolbar hiding once the pointer leaves its row. Watching its
  // size catches all three: a detached or undisplayed element reports 0x0.
  //   - removed (or never there): the popup would be misplaced, so it hides until there is one again,
  //     and keys and clicks go to what is under it
  //   - there but not rendered: it stays open and usable where it last was (master placed a popup
  //     once and left it there), and follows the anchor again once it is rendered
  const syncAnchor = () => {
    const current = attachTo?.current
    const anchor = current instanceof HTMLElement && current.isConnected ? current : null
    if (anchor !== anchorRef.current) {
      setAnchorName(anchorRef.current, anchorName, false)
      setAnchorName(anchor, anchorName, true)
      anchorRef.current = anchor
      if (anchor) {
        anchorPathRef.current = ancestorsOf(anchor)
      }
      anchorObserverRef.current?.disconnect()
      if (anchor) {
        if (!anchorObserverRef.current) {
          anchorObserverRef.current = new ResizeObserver(() => syncAnchorRef.current())
        }
        anchorObserverRef.current.observe(anchor)
      }
    }
    const popup = popupRef.current
    const rendered = !!anchor && anchor.checkVisibility()
    const last = lastPlaceRef.current
    const held = !!anchor && !rendered && !!last
    if (popup && rendered) {
      popup.removeAttribute('data-held')
      // only a placement made with its size known is where it really goes
      if (!popup.hasAttribute('data-unsized')) {
        const {left, top, width} = popup.getBoundingClientRect()
        lastPlaceRef.current = {left, top, width}
      }
    } else if (popup && held && !popup.hasAttribute('data-held')) {
      popup.style.setProperty(heldLeftVar, `${last.left}px`)
      popup.style.setProperty(heldTopVar, `${last.top}px`)
      popup.style.setProperty(heldWidthVar, `${last.width}px`)
      popup.setAttribute('data-held', '')
    }
    popup?.toggleAttribute('data-unanchored', !rendered && !held)
    setEntryDormant(id, !rendered && !held)
  }
  const syncAnchorRef = React.useRef(syncAnchor)

  const {id, ref, shown} = useOverlayEntry({
    acceptsKeys: !!onHidden && !disableEscapeKey,
    // once its anchor is gone (maybe not noticed yet), by where that anchor was, so a list row
    // recycled meanwhile still closes it
    anchoredWithin: element =>
      anchorRef.current?.isConnected
        ? element.contains(anchorRef.current)
        : anchorPathRef.current.includes(element),
    blocking: false,
    kind: 'popup',
    onEscape: onHidden,
    outside: onHidden
      ? {content: () => contentRef.current, onOutside: onHidden, propagate: !!propagateOutsideClicks}
      : undefined,
    stoppedEscapeCloses: false,
    syncAnchor: () => syncAnchorRef.current(),
  })

  // attachTo's element can change from one render to the next, so check it on every one. What is
  // inside mounts a commit after the popup, so this also runs once whatever was rendered after the
  // popup has attached its refs.
  React.useLayoutEffect(() => {
    syncAnchorRef.current = syncAnchor
    syncAnchor()
  })

  React.useLayoutEffect(
    () => () => {
      anchorObserverRef.current?.disconnect()
      setAnchorName(anchorRef.current, anchorName, false)
      anchorRef.current = undefined
    },
    [anchorName]
  )

  const setPopup = React.useCallback(
    (popup: HTMLDivElement | null) => {
      popupRef.current = popup
      if (!popup) {
        return undefined
      }
      // Fitting a popup into the viewport needs its size, which CSS can't read in its own insets.
      // Until it is measured it would be placed as if it had no size, possibly over its own anchor,
      // so it is not drawn and takes no clicks (see measureContent).
      popup.setAttribute('data-unsized', '')
      const observer = new ResizeObserver(([entry]) => {
        const size = entry?.borderBoxSize[0]
        if (size) {
          setSize(popup, size.inlineSize, size.blockSize)
        }
        syncAnchorRef.current()
      })
      observer.observe(popup)
      const cleanup = ref(popup)
      return () => {
        observer.disconnect()
        cleanup?.()
        popupRef.current = null
      }
    },
    [ref, syncAnchorRef]
  )

  // Runs as soon as what is inside is committed, before anything in it focuses itself (autoFocus,
  // focus in an effect): measured and drawn by then, the popup can take focus.
  const measureContent = React.useCallback(
    (probe: HTMLElement | null) => {
      const popup = popupRef.current
      if (!probe || !popup) {
        return
      }
      const {height, width} = popup.getBoundingClientRect()
      setSize(popup, width, height)
      syncAnchorRef.current()
    },
    [syncAnchorRef]
  )

  const {base} = placement
  const popupStyle = {
    [offsetVar]: `${offset}px`,
    alignSelf: base.alignSelf,
    bottom: base.bottom,
    justifySelf: base.justifySelf,
    left: base.left,
    maxWidth: popupMaxWidth,
    positionAnchor: anchorName,
    positionTryFallbacks: placement.tryOptions,
    right: base.right,
    top: base.top,
    width: base.width,
  } as React.CSSProperties

  const host = document.getElementById('modal-root')
  return host ? (
    <>
      <style href={placement.tryOptions} precedence="floating-box">
        {placement.rules}
      </style>
      {ReactDOM.createPortal(
        <div
          popover="manual"
          className="floating-box"
          data-overlay-entry={id}
          style={popupStyle}
          ref={setPopup}
        >
          {shown ? (
            <OverlayEntryContext value={id}>
              <div className="floating-box-content" ref={contentRef} style={Styles.castStyleDesktop(style)}>
                <EntryContent>
                  {/* first, so it runs before what follows; inside the Suspense, so it runs when
                      lazily loaded content is shown */}
                  <span hidden={true} ref={measureContent} />
                  {children}
                </EntryContent>
              </div>
            </OverlayEntryContext>
          ) : null}
        </div>,
        host
      )}
    </>
  ) : null
}
