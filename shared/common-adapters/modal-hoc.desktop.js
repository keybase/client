// @flow
import * as React from 'react'
import includes from 'lodash/includes'
import Box from './box'
import ReactDOM from 'react-dom'
import {globalStyles, globalColors} from '../styles'
import {findDOMNode} from 'react-dom'

const modalRoot = document.getElementById('modal-root')

// Move this to a single file
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

type ModalPositionRelativeProps = {
  targetNode: ?React$Component<*>,
}

function ModalPositionRelative<P>(
  WrappedComponent: React.ComponentType<P>
): React.ComponentType<P & ModalPositionRelativeProps> {
  class Modal extends React.Component<P & ModalPositionRelativeProps, {style: {}}> {
    popupRef: React$Component<*>
    state: {style: {}}
    constructor() {
      super()
      this.state = {style: {}}
    }

    _computeStyle = (targetNode: ?React$Component<*>) => {
      if (!targetNode) return
      const popupNode = this.popupRef
      if (!(targetNode instanceof HTMLElement) || !(popupNode instanceof HTMLElement)) {
        console.error('null nodes for popup')
        return
      }
      // TODO parameterize position
      const style = computePopupStyle(
        'bottom left',
        targetNode.getBoundingClientRect(),
        popupNode.getBoundingClientRect()
      )

      this.setState({style})
    }

    componentWillReceiveProps(nextProps: P & ModalPositionRelativeProps) {
      if (!this.props.targetNode && nextProps.targetNode) {
        this._computeStyle(nextProps.targetNode)
      }
    }

    _setRef = r => {
      if (!r) return
      this.popupRef = r
      this._computeStyle(this.props.targetNode)
    }

    render() {
      return (
        <Box style={this.state.style}>
          <Ref setTargetNode={this._setRef}>
            <WrappedComponent {...(this.props: P)} />
          </Ref>
        </Box>
      )
    }
  }

  return Modal
}

export default ModalHoc
export {ModalPositionRelative}
