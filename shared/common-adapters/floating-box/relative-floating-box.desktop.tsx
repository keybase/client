import * as React from 'react'
import * as Styles from '@/styles'
import includes from 'lodash/includes'
import Box from '@/common-adapters/box'
import ReactDOM from 'react-dom'
import {EscapeHandler} from '../key-event-handler.desktop'
import type {MeasureDesktop} from '@/common-adapters/measure-ref'

const Kb = {Box}

type ComputedStyle = {
  position: string
  top?: number | 'auto'
  left?: number | 'auto'
  right?: number | 'auto'
  bottom?: number | 'auto'
}

// Modified from https://github.com/Semantic-Org/Semantic-UI-React/blob/454daaab6e31459741e1cbce1b0c9a1a5f07bd2e/src/modules/Popup/Popup.js#L150
function _computePopupStyle(
  position: Styles.Position,
  coords: MeasureDesktop,
  popupCoords: MeasureDesktop,
  matchDimension: boolean,
  offset: number
): ComputedStyle {
  const style: ComputedStyle = {position: 'absolute'}

  const {
    pageYOffset,
    pageXOffset,
  }: {
    pageYOffset: number
    pageXOffset: number
  } = window
  const {clientWidth, clientHeight} = document.documentElement

  if (includes(position, 'right')) {
    style.right = Math.round(clientWidth - (coords.right + pageXOffset) + offset)
    style.left = 'auto'
  } else if (includes(position, 'left')) {
    style.left = Math.round(coords.left + pageXOffset + offset)
    style.right = 'auto'
  } else if (matchDimension) {
    style.left = Math.round(coords.left + pageXOffset)
    style.right = Math.round(clientWidth - (coords.right + pageXOffset))
  } else {
    // if not left nor right, we are horizontally centering the element
    const xOffset = (coords.width - popupCoords.width) / 2
    style.left = Math.round(coords.left + xOffset + pageXOffset)
    style.right = 'auto'
  }

  if (includes(position, 'top')) {
    style.bottom = Math.round(clientHeight - (coords.top + pageYOffset) - offset)
    style.top = 'auto'
  } else if (includes(position, 'bottom')) {
    style.top = Math.round(coords.bottom + pageYOffset - offset)
    style.bottom = 'auto'
  } else if (matchDimension) {
    style.bottom = Math.round(clientHeight - (coords.top + pageYOffset))
    style.top = Math.round(coords.bottom + pageYOffset)
  } else {
    // if not top nor bottom, we are vertically centering the element
    const yOffset = (coords.height + popupCoords.height) / 2
    style.top = Math.round(coords.bottom + pageYOffset - yOffset)
    style.bottom = 'auto'

    const xOffset = popupCoords.width + 8
    if (includes(position, 'right') && typeof style.right === 'number') {
      style.right -= xOffset
    } else if (includes(position, 'left') && typeof style.left === 'number') {
      style.left -= xOffset
    }
  }

  return style
}

function isStyleInViewport(style: ComputedStyle, popupCoords: MeasureDesktop): boolean {
  const {
    pageYOffset,
    pageXOffset,
  }: {
    pageYOffset: number
    pageXOffset: number
  } = window
  const {clientWidth, clientHeight} = document.documentElement

  const element = {
    height: popupCoords.height,
    left: style.left,
    top: style.top,
    width: popupCoords.width,
  }
  if (typeof style.right === 'number') {
    element.left = clientWidth - style.right - element.width
  }
  if (typeof style.bottom === 'number') {
    element.top = clientHeight - style.bottom - element.height
  }

  // hidden on top
  if (typeof element.top === 'number' && element.top < pageYOffset) {
    return false
  }
  // hidden on the bottom
  if (typeof element.top === 'number' && element.top + element.height > pageYOffset + clientHeight)
    return false
  // hidden the left
  if (typeof element.left === 'number' && element.left < pageXOffset) {
    return false
  }
  // hidden on the right
  if (typeof element.left === 'number' && element.left + element.width > pageXOffset + clientWidth)
    return false

  return true
}

function pushStyleIntoViewport(style: ComputedStyle, popupCoords: MeasureDesktop, offset: number) {
  const {
    pageYOffset,
    pageXOffset,
  }: {
    pageYOffset: number
    pageXOffset: number
  } = window
  const {clientWidth, clientHeight} = document.documentElement

  const element = {
    height: popupCoords.height,
    left: style.left,
    top: style.top,
    width: popupCoords.width,
  }
  if (typeof style.right === 'number') {
    element.left = clientWidth - style.right - element.width
  }
  if (typeof style.bottom === 'number') {
    element.top = clientHeight - style.bottom - element.height
  }

  if (typeof element.top === 'number' && element.top < pageYOffset) {
    // push down
    const off = pageYOffset - element.top
    if (typeof style.top === 'number') {
      style.top += off + offset
    }
    if (typeof style.bottom === 'number') {
      style.bottom -= off + offset
    }
  } else if (typeof element.top === 'number' && element.top + element.height > pageYOffset + clientHeight) {
    // push up
    const off = element.top + element.height - (pageYOffset + clientHeight)
    if (typeof style.top === 'number') {
      style.top -= off + offset
    }
    if (typeof style.bottom === 'number') {
      style.bottom += off + offset
    }
  }

  if (typeof element.left === 'number' && element.left < pageXOffset) {
    // push right
    const off = pageXOffset - element.left
    if (typeof style.left === 'number') {
      style.left += off + offset
    }
    if (typeof style.right === 'number') {
      style.right -= off + offset
    }
  } else if (typeof element.left === 'number' && element.left + element.width > pageXOffset + clientWidth) {
    // push left
    const off = element.left + element.width - (pageXOffset + clientWidth)
    if (typeof style.left === 'number') {
      style.left -= off + offset
    }
    if (typeof style.right === 'number') {
      style.right += off + offset
    }
  }

  return style
}

const allPositions: Array<Styles.Position> = [
  'top left',
  'top right',
  'bottom right',
  'bottom left',
  'right center',
  'left center',
  'top center',
  'bottom center',
  'center center',
]

function computePopupStyle(
  position: Styles.Position,
  coords: MeasureDesktop,
  popupCoords: DOMRect,
  matchDimension: boolean,
  // When specified, will only use the fallbacks regardless of visibility
  positionFallbacks?: ReadonlyArray<Styles.Position>,
  _offset?: number
): ComputedStyle {
  const offset = _offset ?? 0
  let style = _computePopupStyle(position, coords, popupCoords, matchDimension, offset)

  const positionsShuffled = positionFallbacks ?? allPositions
  for (let i = 0; !isStyleInViewport(style, popupCoords) && i < positionsShuffled.length; i += 1) {
    style = _computePopupStyle(positionsShuffled[i]!, coords, popupCoords, matchDimension, offset)
  }
  if (!isStyleInViewport(style, popupCoords)) {
    style = pushStyleIntoViewport(style, popupCoords, offset * 2) // *2 since we included the offset already so we need to move twice that
  }
  return style
}

type ModalPositionRelativeProps = {
  targetRect?: MeasureDesktop
  position: Styles.Position
  positionFallbacks?: ReadonlyArray<Styles.Position>
  matchDimension?: boolean
  onClosePopup: () => void
  propagateOutsideClicks?: boolean
  remeasureHint?: number
  style?: Styles.StylesCrossPlatform
  children: React.ReactNode
  disableEscapeKey?: boolean // if true, ignore keys
  offset?: number // offset in pixels from edge
}

export const RelativeFloatingBox = (props: ModalPositionRelativeProps) => {
  const [popupNode, setPopupNode] = React.useState<HTMLDivElement | null>(null)
  const downRef = React.useRef<undefined | {x: number; y: number}>()
  const [style, setStyle] = React.useState<Styles.StylesCrossPlatform>({opacity: 0, pointerEvents: 'none'})
  const {targetRect, children, propagateOutsideClicks, onClosePopup, style: _style} = props
  const {position, matchDimension, positionFallbacks, disableEscapeKey, offset = 0} = props

  const handleDown = React.useCallback((e: MouseEvent) => {
    downRef.current = {x: e.clientX, y: e.clientY}
  }, [])

  const handleClick = React.useCallback(
    (e: MouseEvent) => {
      if (popupNode && e.target instanceof HTMLElement && !popupNode.contains(e.target)) {
        !propagateOutsideClicks && e.stopPropagation()
        onClosePopup()
      }
    },
    [onClosePopup, propagateOutsideClicks, popupNode]
  )

  const handleUp = React.useCallback(
    (e: MouseEvent) => {
      if (!downRef.current) {
        return
      }

      const {x, y} = downRef.current
      downRef.current = undefined
      const {clientX, clientY} = e
      if (Math.abs(x - clientX) < 5 && Math.abs(y - clientY) < 5) {
        handleClick(e)
      }
    },
    [handleClick]
  )

  React.useEffect(() => {
    const node = document.body
    node.addEventListener('mousedown', handleDown, {capture: true})
    node.addEventListener('mouseup', handleUp, {capture: true})
    return () => {
      node.removeEventListener('mousedown', handleDown, {capture: true})
      node.removeEventListener('mouseup', handleUp, {capture: true})
    }
  }, [handleDown, handleUp])

  React.useEffect(() => {
    if (targetRect && popupNode) {
      const s = Styles.collapseStyles([
        computePopupStyle(
          position,
          targetRect,
          popupNode.getBoundingClientRect(),
          !!matchDimension,
          positionFallbacks,
          offset
        ),
        _style,
      ] as any)
      setStyle(s)
    }
  }, [_style, matchDimension, position, positionFallbacks, popupNode, targetRect, offset])

  const modalRoot = document.getElementById('modal-root')
  return modalRoot
    ? ReactDOM.createPortal(
        <div style={Styles.castStyleDesktop(style)} ref={setPopupNode}>
          {disableEscapeKey ? (
            <Kb.Box className="fade-in-generic"> {children} </Kb.Box>
          ) : (
            <EscapeHandler onESC={onClosePopup}>
              <Kb.Box className="fade-in-generic"> {children} </Kb.Box>
            </EscapeHandler>
          )}
        </div>,
        modalRoot
      )
    : null
}
