// @flow

import * as React from 'react'
import includes from 'lodash/includes'
import throttle from 'lodash/throttle'
import Box from './box'
import ReactDOM, {findDOMNode} from 'react-dom'
import {withState} from '../util/container'
import EscapeHandler from '../util/escape-handler'

const modalRoot = document.getElementById('modal-root')

class DOMNodeFinder
  extends React.Component<{setNode: (node: HTMLElement) => void, children: React.Element<*>}> {
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

function ModalHoc<P: {}>(WrappedComponent: React.ComponentType<P>): React.ComponentType<P> {
  class Modal extends React.Component<P> {
    el: HTMLElement
    constructor() {
      super()
      this.el = document.createElement('div')
    }

    componentDidMount() {
      modalRoot && modalRoot.appendChild(this.el)
    }

    componentWillUnmount() {
      modalRoot && modalRoot.removeChild(this.el)
    }

    render() {
      return ReactDOM.createPortal(<WrappedComponent {...this.props} />, this.el)
    }
  }

  return Modal
}

type Position =
  | 'top left'
  | 'top right'
  | 'bottom right'
  | 'bottom left'
  | 'right center'
  | 'left center'
  | 'top center'
  | 'bottom center'
type ComputedStyle = {
  position: string,
  top?: number | 'auto',
  left?: number | 'auto',
  right?: number | 'auto',
  bottom?: number | 'auto',
}
// Modified from https://github.com/Semantic-Org/Semantic-UI-React/blob/454daaab6e31459741e1cbce1b0c9a1a5f07bd2e/src/modules/Popup/Popup.js#L150
function computePopupStyle(
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

type ModalPositionRelativeProps<PP> = {
  targetNode: ?HTMLElement,
  position: Position,
  onClose: () => void,
  popupProps: PP,
}

function ModalPositionRelative<PP>(
  WrappedComponent: React.ComponentType<PP>
): React.ComponentType<ModalPositionRelativeProps<PP>> {
  class Modal extends React.Component<ModalPositionRelativeProps<PP>, {style: {}}> {
    popupNode: ?HTMLElement
    state: {style: {}}
    constructor() {
      super()
      this.state = {style: {}}
    }

    _computeStyle = (targetNode: ?HTMLElement) => {
      if (!targetNode) return
      const popupNode = this.popupNode
      if (!(targetNode instanceof HTMLElement) || !(popupNode instanceof HTMLElement)) {
        console.error('null nodes for popup')
        return
      }

      const style = computePopupStyle(
        this.props.position,
        targetNode.getBoundingClientRect(),
        popupNode.getBoundingClientRect()
      )

      this.setState({style})
    }

    componentWillReceiveProps(nextProps: ModalPositionRelativeProps<PP>) {
      if (!this.props.targetNode && nextProps.targetNode) {
        this._computeStyle(nextProps.targetNode)
      }
    }

    _handleClick = (e: MouseEvent) => {
      if (this.popupNode && e.target instanceof HTMLElement && !this.popupNode.contains(e.target)) {
        this.props.onClose()
      }
    }

    _handleScroll = throttle(
      () => {
        this.props.onClose()
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
      this._computeStyle(this.props.targetNode)
    }

    render() {
      return (
        <Box style={this.state.style}>
          <EscapeHandler onESC={this.props.onClose}>
            <DOMNodeFinder setNode={this._setRef}>
              <WrappedComponent {...(this.props.popupProps: PP)} />
            </DOMNodeFinder>
          </EscapeHandler>
        </Box>
      )
    }
  }

  return Modal
}

type RelativePopupProps<TP, PP> = {
  open: boolean,
  onClose: () => void,
  position: Position,
  targetProps: TP,
  popupProps: PP,
}

function RelativePopupHoc<TP, PP>(
  TargetComponent: React.ComponentType<TP>,
  PopupComponent: React.ComponentType<PP>
): React.ComponentType<RelativePopupProps<TP, PP>> {
  const ModalPopupComponent = ModalHoc(ModalPositionRelative(PopupComponent))
  return withState(
    'targetNode',
    'setTargetNode',
    null
  )(
    (
      props: {targetNode: ?HTMLElement, setTargetNode: (node: HTMLElement) => void} & RelativePopupProps<
        TP,
        PP
      >
    ) => {
      return (
        <Box>
          <DOMNodeFinder setNode={props.setTargetNode}>
            <TargetComponent {...(props.targetProps: TP)} />
          </DOMNodeFinder>
          {props.open &&
            <ModalPopupComponent
              onClose={props.onClose}
              position={props.position}
              targetNode={props.targetNode}
              popupProps={props.popupProps}
            />}
        </Box>
      )
    }
  )
}

export default RelativePopupHoc
