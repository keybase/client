// @flow
import logger from '../logger'
import * as React from 'react'
import {includes, throttle, without} from 'lodash-es'
import Box from './box'
import ReactDOM, {findDOMNode} from 'react-dom'
import EscapeHandler from '../util/escape-handler.desktop'
import {connect} from '../util/container'
import {type StylesCrossPlatform, collapseStyles} from '../styles'
import type {Position, RelativePopupHocType, Props} from './relative-popup-hoc.types'

class DOMNodeFinder extends React.Component<{
  setNode: (node: HTMLElement) => void,
  children: React.Element<any>,
}> {
  componentDidMount() {
    const {setNode} = this.props
    const node = findDOMNode(this)
    if (node instanceof HTMLElement) {
      setNode && setNode(node)
    }
  }

  render() {
    const {children} = this.props
    return React.Children.only(children)
  }
}
const getModalRoot = () => document.getElementById('modal-root')
class Modal extends React.Component<{setNode: (node: HTMLElement) => void, children: React.Element<any>}> {
  el: HTMLElement
  constructor() {
    super()
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
  position: string,
  zIndex: number,
  top?: number | 'auto',
  left?: number | 'auto',
  right?: number | 'auto',
  bottom?: number | 'auto',
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
  offset: ?number
): ComputedStyle {
  const style: ComputedStyle = {position: 'absolute', zIndex: 30}

  const {pageYOffset, pageXOffset} = window
  const {clientWidth, clientHeight} = document.documentElement || {clientWidth: 800, clientHeight: 800}

  if (includes(position, 'right')) {
    style.right = Math.round(clientWidth - (coords.right + pageXOffset))
    style.left = 'auto'
  } else if (includes(position, 'left')) {
    style.left = Math.round(coords.left + pageXOffset)
    style.right = 'auto'
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
  const {pageYOffset, pageXOffset} = window
  const {clientWidth, clientHeight} = document.documentElement || {clientWidth: 800, clientHeight: 800}

  const element = {
    top: style.top,
    left: style.left,
    width: popupCoords.width,
    height: popupCoords.height,
  }
  if (typeof style.right === 'number') {
    element.left = clientWidth - style.right - element.width
  }
  if (typeof style.bottom === 'number') {
    element.top = clientHeight - style.bottom - element.height
  }

  // hidden on top
  if (element.top < pageYOffset) return false
  // hidden on the bottom
  if (element.top + element.height > pageYOffset + clientHeight) return false
  // hidden the left
  if (element.left < pageXOffset) return false
  // hidden on the right
  if (element.left + element.width > pageXOffset + clientWidth) return false

  return true
}

function computePopupStyle(
  position: Position,
  coords: ClientRect,
  popupCoords: ClientRect,
  offset: ?number,
  // When specified, will only use the fallbacks regardless of visibility
  positionFallbacks?: Position[]
): ComputedStyle {
  let style = _computePopupStyle(position, coords, popupCoords, offset)

  const positionsShuffled = positionFallbacks || without(positions, position).concat([position])
  for (let i = 0; !isStyleInViewport(style, popupCoords) && i < positionsShuffled.length; i += 1) {
    style = _computePopupStyle(positionsShuffled[i], coords, popupCoords, offset)
  }
  return style
}

type ModalPositionRelativeProps<PP> = {
  targetRect: ?ClientRect,
  position: Position,
  positionFallbacks?: Position[],
  onClosePopup: () => void,
  propagateOutsideClicks?: boolean,
  style?: StylesCrossPlatform,
} & PP

function ModalPositionRelative<PP>(
  WrappedComponent: React.ComponentType<PP>
): React.ComponentType<ModalPositionRelativeProps<PP>> {
  class ModalPositionRelativeClass extends React.Component<ModalPositionRelativeProps<PP>, {style: {}}> {
    popupNode: ?HTMLElement
    state: {style: {}}
    constructor() {
      super()
      this.state = {style: {}}
    }

    _computeStyle = (targetRect: ?ClientRect) => {
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
          null,
          this.props.positionFallbacks
        ),
        this.props.style,
      ])
      this.setState({style})
    }

    getSnapshotBeforeUpdate(prevProps) {
      const {width, height} = this.popupNode
        ? this.popupNode.getBoundingClientRect()
        : {width: -1, height: -1}
      return {width, height}
    }

    componentDidUpdate(prevProps: ModalPositionRelativeProps<PP>, prevState, snapshot) {
      if (this.props.targetRect && this.props.targetRect !== prevProps.targetRect) {
        this._computeStyle(this.props.targetRect)
      }

      if (includes(this.props.position, 'center')) {
        // If we need to center, the offset calculation depends on rendered
        // bounding rect. If rendering changes the bounding rect, we need to
        // re-calculate offsets.
        const {width, height} = this.popupNode
          ? this.popupNode.getBoundingClientRect()
          : {width: -1, height: -1}
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
                <WrappedComponent {...(this.props: PP)} />
              </EscapeHandler>
            )}
            {!this.props.onClosePopup && <WrappedComponent {...(this.props: PP)} />}
          </Box>
        </Modal>
      )
    }
  }

  return ModalPositionRelativeClass
}

const RelativePopupHoc: RelativePopupHocType<any> = PopupComponent => {
  const ModalPopupComponent: React.ComponentType<ModalPositionRelativeProps<any>> = ModalPositionRelative(
    PopupComponent
  )

  const C: React.ComponentType<Props<any>> = connect(
    () => ({}),
    (dispatch, {navigateUp, routeProps}) => ({
      onClosePopup: () => {
        dispatch(navigateUp())
        const onPopupWillClose = routeProps.get('onPopupWillClose')
        onPopupWillClose && onPopupWillClose()
      },
      targetRect: routeProps.get('targetRect'),
      position: routeProps.get('position'),
    }),
    (s, d, o) => ({...o, ...s, ...d})
  )((props: Props<any> & {onClosePopup: () => void}) => {
    // $FlowIssue
    return <ModalPopupComponent {...(props: Props<any>)} onClosePopup={props.onClosePopup} />
  })

  return C
}

export {DOMNodeFinder, ModalPositionRelative}
export default RelativePopupHoc
export type {Position} from './relative-popup-hoc.types'
