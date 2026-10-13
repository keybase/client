import * as React from 'react'
import * as Styles from '@/styles'
import ReactDOM from 'react-dom'
import type {MeasureRef} from '../../measure-ref'
import {OverlayEntryContext} from '../../overlay/context'
import {useOverlayEntry} from '../../overlay/entry.desktop'
import {heightVar, offsetVar, popupPlacement, widthVar} from './placement.desktop'

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

export const RelativeFloatingBox = (props: ModalPositionRelativeProps) => {
  const {attachTo, children, propagateOutsideClicks, onHidden, style} = props
  const {position, matchDimension = false, positionFallbacks, disableEscapeKey, offset = 0} = props
  const popupRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  // undefined until the first check, so a popup with nothing to anchor to starts hidden
  const anchorRef = React.useRef<HTMLElement | null | undefined>(undefined)
  const anchorObserverRef = React.useRef<ResizeObserver | null>(null)
  const anchorName = `--kb-anchor-${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const placement = popupPlacement(position, matchDimension, positionFallbacks)

  // The anchor can be replaced or removed without this re-rendering, e.g. a list row re-rendering
  // on its own. Watching its size catches that: a detached element reports 0x0.
  const syncAnchor = () => {
    const current = attachTo?.current
    const anchor = current instanceof HTMLElement && current.isConnected ? current : null
    if (anchor === anchorRef.current) {
      return
    }
    setAnchorName(anchorRef.current, anchorName, false)
    setAnchorName(anchor, anchorName, true)
    anchorRef.current = anchor
    // with nothing to anchor to the popup would be misplaced, so it stays hidden until there is
    popupRef.current?.toggleAttribute('data-unanchored', !anchor)
    anchorObserverRef.current?.disconnect()
    if (anchor) {
      if (!anchorObserverRef.current) {
        anchorObserverRef.current = new ResizeObserver(() => syncAnchorRef.current())
      }
      anchorObserverRef.current.observe(anchor)
    }
  }
  const syncAnchorRef = React.useRef(syncAnchor)

  const {id, ref, shown} = useOverlayEntry({
    acceptsKeys: !!onHidden && !disableEscapeKey,
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
      // fitting a popup into the viewport needs its size, which CSS can't read in its own insets
      const observer = new ResizeObserver(([entry]) => {
        const size = entry?.borderBoxSize[0]
        if (size) {
          popup.style.setProperty(widthVar, `${size.inlineSize}px`)
          popup.style.setProperty(heightVar, `${size.blockSize}px`)
        }
      })
      observer.observe(popup)
      const cleanup = ref(popup)
      return () => {
        observer.disconnect()
        cleanup?.()
        popupRef.current = null
      }
    },
    [ref]
  )

  const {base} = placement
  const popupStyle = {
    [offsetVar]: `${offset}px`,
    alignSelf: base.alignSelf,
    bottom: base.bottom,
    justifySelf: base.justifySelf,
    left: base.left,
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
                {children}
              </div>
            </OverlayEntryContext>
          ) : null}
        </div>,
        host
      )}
    </>
  ) : null
}
