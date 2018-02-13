// @flow
import logger from '../logger'
import * as React from 'react'
import includes from 'lodash/includes'
import throttle from 'lodash/throttle'
import without from 'lodash/without'
import Box from './box'
import ReactDOM, {findDOMNode} from 'react-dom'
import EscapeHandler from '../util/escape-handler'
import {connect} from 'react-redux'

import type {Position, RelativePopupHocType, RelativePopupProps} from './relative-popup-hoc'

const modalRoot = document.getElementById('modal-root')

class DOMNodeFinder extends React.Component<{
  setNode: (node: HTMLElement) => void,
  children: React.Element<*>,
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

class Modal extends React.Component<{setNode: (node: HTMLElement) => void, children: React.Element<*>}> {
  el: HTMLElement
  constructor() {
    super()
    this.el = document.createElement('div')
  }

  componentDidMount() {
    modalRoot && modalRoot.appendChild(this.el)
    const firstChild = this.el.firstChild
    if (firstChild instanceof HTMLElement) {
      this.props.setNode(firstChild)
    }
  }

  componentWillUnmount() {
    modalRoot && modalRoot.removeChild(this.el)
  }

  render() {
    const {children} = this.props
    return ReactDOM.createPortal(React.Children.only(children), this.el)
  }
}

type ComputedStyle = {
  position: string,
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
]

// Modified from https://github.com/Semantic-Org/Semantic-UI-React/blob/454daaab6e31459741e1cbce1b0c9a1a5f07bd2e/src/modules/Popup/Popup.js#L150
function _computePopupStyle(
  position: Position,
  coords: ClientRect,
  popupCoords: ClientRect,
  offset: ?number
): ComputedStyle {
  const style: ComputedStyle = {position: 'absolute'}

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
    } else if (typeof style.left === 'number') {
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
  offset: ?number
): ComputedStyle {
  let style = _computePopupStyle(position, coords, popupCoords, offset)

  const positionsShuffled = without(positions, position).concat([position])
  for (let i = 0; !isStyleInViewport(style, popupCoords) && i < positionsShuffled.length; i += 1) {
    style = _computePopupStyle(positionsShuffled[i], coords, popupCoords, offset)
  }
  return style
}

type ModalPositionRelativeProps<PP> = {
  targetRect: ?ClientRect,
  position: Position,
  onClosePopup: () => void,
  style?: Object,
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

      const style = {
        ...computePopupStyle(this.props.position, targetRect, popupNode.getBoundingClientRect()),
        ...this.props.style,
      }

      this.setState({style})
    }

    componentWillReceiveProps(nextProps: ModalPositionRelativeProps<PP>) {
      if (nextProps.targetRect && this.props.targetRect !== nextProps.targetRect) {
        this._computeStyle(nextProps.targetRect)
      }
    }

    _handleClick = (e: MouseEvent) => {
      if (this.popupNode && e.target instanceof HTMLElement && !this.popupNode.contains(e.target)) {
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
            <EscapeHandler onESC={this.props.onClosePopup}>
              <WrappedComponent {...(this.props: PP)} />
            </EscapeHandler>
          </Box>
        </Modal>
      )
    }
  }

  return ModalPositionRelativeClass
}

const RelativePopupHoc: RelativePopupHocType<*> = PopupComponent => {
  const ModalPopupComponent: React.ComponentType<ModalPositionRelativeProps<*>> = ModalPositionRelative(
    PopupComponent
  )

  const C: React.ComponentType<RelativePopupProps<*>> = connect(
    undefined,
    (dispatch, {navigateUp, routeProps}) => ({
      onClosePopup: () => {
        dispatch(navigateUp())
        const onPopupWillClose = routeProps.get('onPopupWillClose')
        onPopupWillClose && onPopupWillClose()
      },
      targetRect: routeProps.get('targetRect'),
      position: routeProps.get('position'),
    })
  )((props: RelativePopupProps<*> & {onClosePopup: () => void}) => {
    return <ModalPopupComponent {...(props: RelativePopupProps<*>)} onClosePopup={props.onClosePopup} />
  })

  return C
}

export {DOMNodeFinder, ModalPositionRelative}
export default RelativePopupHoc
