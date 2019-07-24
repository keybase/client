import logger from '../logger'
import * as React from 'react'
import {includes, throttle, without} from 'lodash-es'
import Box from './box'
import ReactDOM from 'react-dom'
import {EscapeHandler} from '../util/key-event-handler.desktop'
import {StylesCrossPlatform, collapseStyles} from '../styles'
import {Position} from './relative-popup-hoc.types'

const getModalRoot = () => document.getElementById('modal-root')
class Modal extends React.Component<{
  setNode: (node: HTMLElement) => void
}> {
  el: HTMLElement
  constructor(props) {
    super(props)
    this.el = document.createElement('div')
  }

  componentDidMount() {
    const modalRoot = getModalRoot()
    modalRoot && modalRoot.appendChild(this.el)
    const firstChild = this.el.firstChild
    if (firstChild instanceof HTMLElement) {
      this.props.setNode(firstChild)
    }
  }

  componentWillUnmount() {
    const modalRoot = getModalRoot()
    modalRoot && modalRoot.removeChild(this.el)
  }

  render() {
    const {children} = this.props
    return ReactDOM.createPortal(React.Children.only(children), this.el)
  }
}

type ComputedStyle = {
  position: string
  top?: number | 'auto'
  left?: number | 'auto'
  right?: number | 'auto'
  bottom?: number | 'auto'
}

const positions: Array<Position> = [
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

// Modified from https://github.com/Semantic-Org/Semantic-UI-React/blob/454daaab6e31459741e1cbce1b0c9a1a5f07bd2e/src/modules/Popup/Popup.js#L150
function _computePopupStyle(
  position: Position,
  coords: ClientRect,
  popupCoords: ClientRect,
  matchDimension: boolean,
  offset: number | null
): ComputedStyle {
  const style: ComputedStyle = {position: 'absolute'}

  const {
    pageYOffset,
    pageXOffset,
  }: {
    pageYOffset: number
    pageXOffset: number
  } = window
  const {clientWidth, clientHeight} = document.documentElement || {clientHeight: 800, clientWidth: 800}

  if (includes(position, 'right')) {
    style.right = Math.round(clientWidth - (coords.right + pageXOffset))
    style.left = 'auto'
  } else if (includes(position, 'left')) {
    style.left = Math.round(coords.left + pageXOffset)
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
    style.bottom = Math.round(clientHeight - (coords.top + pageYOffset))
    style.top = 'auto'
  } else if (includes(position, 'bottom')) {
    style.top = Math.round(coords.bottom + pageYOffset)
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

  if (offset) {
    if (typeof style.right === 'number') {
      style.right -= offset
    } else if (typeof style.left === 'number') {
      style.left -= offset
    }
  }

  return style
}

function isStyleInViewport(style, popupCoords: ClientRect): boolean {
  const {
    pageYOffset,
    pageXOffset,
  }: {
    pageYOffset: number
    pageXOffset: number
  } = window
  const {clientWidth, clientHeight} = document.documentElement || {clientHeight: 800, clientWidth: 800}

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
  if (typeof element.top === 'number' && element.top < pageYOffset) return false
  // hidden on the bottom
  if (typeof element.top === 'number' && element.top + element.height > pageYOffset + clientHeight)
    return false
  // hidden the left
  if (typeof element.left === 'number' && element.left < pageXOffset) return false
  // hidden on the right
  if (typeof element.left === 'number' && element.left + element.width > pageXOffset + clientWidth)
    return false

  return true
}

function pushStyleIntoViewport(style, popupCoords: ClientRect) {
  const {
    pageYOffset,
    pageXOffset,
  }: {
    pageYOffset: number
    pageXOffset: number
  } = window
  const {clientWidth, clientHeight} = document.documentElement || {clientHeight: 800, clientWidth: 800}

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
      style.top += off
    }
    if (typeof style.bottom === 'number') {
      style.bottom -= off
    }
  } else if (typeof element.top === 'number' && element.top + element.height > pageYOffset + clientHeight) {
    // push up
    const off = element.top + element.height - (pageYOffset + clientHeight)
    if (typeof style.top === 'number') {
      style.top -= off
    }
    if (typeof style.bottom === 'number') {
      style.bottom += off
    }
  }

  if (typeof element.left === 'number' && element.left < pageXOffset) {
    // push right
    const off = pageXOffset - element.left
    if (typeof style.left === 'number') {
      style.left += off
    }
    if (typeof style.right === 'number') {
      style.right -= off
    }
  } else if (typeof element.left === 'number' && element.left + element.width > pageXOffset + clientWidth) {
    // push left
    const off = element.left + element.width - (pageXOffset + clientWidth)
    if (typeof style.left === 'number') {
      style.left -= off
    }
    if (typeof style.right === 'number') {
      style.right += off
    }
  }

  return style
}

function computePopupStyle(
  position: Position,
  coords: ClientRect,
  popupCoords: ClientRect,
  matchDimension: boolean,
  offset: number | null,
  // When specified, will only use the fallbacks regardless of visibility
  positionFallbacks?: Position[]
): ComputedStyle {
  let style = _computePopupStyle(position, coords, popupCoords, matchDimension, offset)

  const positionsShuffled = positionFallbacks || without(positions, position).concat([position])
  for (let i = 0; !isStyleInViewport(style, popupCoords) && i < positionsShuffled.length; i += 1) {
    style = _computePopupStyle(positionsShuffled[i], coords, popupCoords, matchDimension, offset)
  }
  if (!isStyleInViewport(style, popupCoords)) {
    style = pushStyleIntoViewport(style, popupCoords)
  }
  return style
}

type ModalPositionRelativeProps<PP> = {
  targetRect: ClientRect | null
  position: Position
  positionFallbacks?: Position[]
  matchDimension?: boolean
  onClosePopup: () => void
  propagateOutsideClicks?: boolean
  style?: StylesCrossPlatform
} & PP

function ModalPositionRelative<PP>(
  WrappedComponent: React.ComponentType<PP>
): React.ComponentType<ModalPositionRelativeProps<PP>> {
  // $FlowIssue TODO modernize
  class ModalPositionRelativeClass extends React.Component<
    ModalPositionRelativeProps<PP>,
    {
      style: {}
    }
  > {
    popupNode: HTMLElement | null = null
    state: {
      style: {}
    }
    constructor(props) {
      super(props)
      this.state = {style: {}}
    }

    _computeStyle = (targetRect: ClientRect | null) => {
      if (!targetRect) return
      const popupNode = this.popupNode
      if (!(popupNode instanceof HTMLElement)) {
        logger.error('null nodes for popup')
        return
      }

      const style = collapseStyles([
        computePopupStyle(
          this.props.position,
          targetRect,
          popupNode.getBoundingClientRect(),
          !!this.props.matchDimension,
          null,
          this.props.positionFallbacks
        ),
        this.props.style,
      ])
      this.setState({style})
    }

    getSnapshotBeforeUpdate() {
      const {width, height} = this.popupNode
        ? this.popupNode.getBoundingClientRect()
        : {height: -1, width: -1}
      return {height, width}
    }

    componentDidUpdate(prevProps: ModalPositionRelativeProps<PP>, _, snapshot) {
      if (this.props.targetRect && this.props.targetRect !== prevProps.targetRect) {
        this._computeStyle(this.props.targetRect)
      }

      if (includes(this.props.position, 'center')) {
        // If we need to center, the offset calculation depends on rendered
        // bounding rect. If rendering changes the bounding rect, we need to
        // re-calculate offsets.
        const {width, height} = this.popupNode
          ? this.popupNode.getBoundingClientRect()
          : {height: -1, width: -1}
        if (snapshot.width !== width || snapshot.height !== height) {
          this._computeStyle(this.props.targetRect)
        }
      }
    }

    _handleClick = (e: MouseEvent) => {
      if (this.popupNode && e.target instanceof HTMLElement && !this.popupNode.contains(e.target)) {
        !this.props.propagateOutsideClicks && e.stopPropagation()
        this.props.onClosePopup()
      }
    }

    _handleScroll = throttle(
      () => {
        // TODO?
        // this.props.onClosePopup()
      },
      500,
      {trailing: false}
    )

    componentDidMount() {
      document.body && document.body.addEventListener('click', this._handleClick)
      document.body && document.body.addEventListener('scroll', this._handleScroll, true)
    }

    componentWillUnmount() {
      document.body && document.body.removeEventListener('click', this._handleClick)
      document.body && document.body.removeEventListener('scroll', this._handleScroll, true)
    }

    _setRef = r => {
      if (!r) return
      this.popupNode = r
      this._computeStyle(this.props.targetRect)
    }

    render() {
      return (
        <Modal setNode={this._setRef}>
          <Box style={this.state.style}>
            {this.props.onClosePopup && (
              <EscapeHandler onESC={this.props.onClosePopup}>
                <WrappedComponent {...this.props as PP} />
              </EscapeHandler>
            )}
            {!this.props.onClosePopup && <WrappedComponent {...this.props as PP} />}
          </Box>
        </Modal>
      )
    }
  }

  return ModalPositionRelativeClass
}

export {ModalPositionRelative}
