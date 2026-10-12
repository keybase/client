import * as React from 'react'
import * as Styles from '@/styles'
import ReactDOM from 'react-dom'
import {EscapeHandler} from '../../key-event-handler.desktop'
import type {MeasureRef} from '../../measure-ref'
import {heightVar, offsetVar, popupPlacement, widthVar} from './placement.desktop'

type ModalPositionRelativeProps = {
  attachTo?: React.RefObject<MeasureRef | null>
  position: Styles.Position
  positionFallbacks?: ReadonlyArray<Styles.Position>
  matchDimension?: boolean
  onClosePopup: () => void
  propagateOutsideClicks?: boolean
  style?: Styles.StylesCrossPlatform
  children: React.ReactNode
  disableEscapeKey?: boolean // if true, ignore keys
  offset?: number // offset in pixels from edge
}

// The top layer stacks popovers in the order they were shown, so a popup opened inside another
// must be shown after it. Effects run children first, so a popup mounted in the same commit as
// the one it is inside waits for that one to be shown.
type PopoverParent = {
  whenShown: (show: () => void) => () => void
}

const makePopoverParent = () => {
  let shown = false
  const waiting = new Set<() => void>()
  return {
    setShown: (next: boolean) => {
      shown = next
      if (shown) {
        waiting.forEach(show => show())
        waiting.clear()
      }
    },
    whenShown: (show: () => void) => {
      if (shown) {
        show()
        return () => {}
      }
      waiting.add(show)
      return () => {
        waiting.delete(show)
      }
    },
  }
}

const shownParent: PopoverParent = {
  whenShown: show => {
    show()
    return () => {}
  },
}
const PopoverParentContext = React.createContext<PopoverParent>(shownParent)

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
  const {attachTo, children, propagateOutsideClicks, onClosePopup, style} = props
  const {position, matchDimension = false, positionFallbacks, disableEscapeKey, offset = 0} = props
  const popupRef = React.useRef<HTMLDivElement>(null)
  // undefined until the first check, so a popup with nothing to anchor to starts hidden
  const anchorRef = React.useRef<HTMLElement | null | undefined>(undefined)
  const downRef = React.useRef<undefined | {x: number; y: number}>(undefined)
  const parent = React.use(PopoverParentContext)
  const [popoverParent] = React.useState(makePopoverParent)
  const anchorName = `--kb-anchor-${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const placement = popupPlacement(position, matchDimension, positionFallbacks)

  // attachTo's element can change from one render to the next, so check it on every one
  React.useLayoutEffect(() => {
    const current = attachTo?.current
    const anchor = current instanceof HTMLElement ? current : null
    if (anchor === anchorRef.current) {
      return
    }
    setAnchorName(anchorRef.current, anchorName, false)
    setAnchorName(anchor, anchorName, true)
    anchorRef.current = anchor
    // with nothing to anchor to the popup would be misplaced, so it stays hidden
    popupRef.current?.toggleAttribute('data-unanchored', !anchor)
  })

  React.useLayoutEffect(
    () => () => {
      setAnchorName(anchorRef.current, anchorName, false)
      anchorRef.current = undefined
    },
    [anchorName]
  )

  React.useLayoutEffect(() => {
    const popup = popupRef.current
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
    const cancel = parent.whenShown(() => {
      popup.showPopover()
      popoverParent.setShown(true)
    })
    return () => {
      cancel()
      observer.disconnect()
      popoverParent.setShown(false)
      popup.hidePopover()
    }
  }, [parent, popoverParent])

  React.useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      downRef.current = {x: e.clientX, y: e.clientY}
    }

    const handleClick = (e: MouseEvent) => {
      const popup = popupRef.current
      if (popup && e.target instanceof HTMLElement && !popup.contains(e.target)) {
        if (!propagateOutsideClicks) {
          e.stopPropagation()
        }
        onClosePopup()
      }
    }

    const handleUp = (e: MouseEvent) => {
      if (!downRef.current) {
        return
      }

      const {x, y} = downRef.current
      downRef.current = undefined
      const {clientX, clientY} = e
      if (Math.abs(x - clientX) < 5 && Math.abs(y - clientY) < 5) {
        handleClick(e)
      }
    }

    const node = document.body
    node.addEventListener('mousedown', handleDown, {capture: true})
    node.addEventListener('mouseup', handleUp, {capture: true})
    return () => {
      node.removeEventListener('mousedown', handleDown, {capture: true})
      node.removeEventListener('mouseup', handleUp, {capture: true})
    }
  }, [onClosePopup, propagateOutsideClicks])

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

  const content = (
    <div className="floating-box-content" style={Styles.castStyleDesktop(style)}>
      {children}
    </div>
  )

  const modalRoot = document.getElementById('modal-root')
  return modalRoot ? (
    <>
      <style href={placement.tryOptions} precedence="floating-box">
        {placement.rules}
      </style>
      {ReactDOM.createPortal(
        <div popover="manual" className="floating-box" style={popupStyle} ref={popupRef}>
          <PopoverParentContext value={popoverParent}>
            {disableEscapeKey ? content : <EscapeHandler onESC={onClosePopup}>{content}</EscapeHandler>}
          </PopoverParentContext>
        </div>,
        modalRoot
      )}
    </>
  ) : null
}
