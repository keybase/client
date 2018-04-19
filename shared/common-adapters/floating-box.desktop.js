// @flow
import * as React from 'react'
import {findDOMNode} from 'react-dom'
import {Box} from './box'
import {ModalPositionRelative} from './relative-popup-hoc.desktop'
import type {Props} from './floating-box'

const RelativeFloatingBox = ModalPositionRelative(Box)

type State = {
  targetRect: ?ClientRect,
}

class FloatingBox extends React.Component<Props, State> {
  state = {targetRect: null}

  static getDerivedStateFromProps(nextProps: Props, prevState: State) {
    if (!nextProps.attachTo) {
      return {targetRect: null}
    }
    const node = findDOMNode(nextProps.attachTo)
    return node instanceof window.HTMLElement
      ? {targetRect: node.getBoundingClientRect()}
      : {targetRect: null}
  }

  render() {
    if (!this.props.visible) {
      return null
    }
    return (
      <RelativeFloatingBox
        position={this.props.position || 'bottom center'}
        targetRect={this.state.targetRect}
        onClosePopup={this.props.onHidden}
      >
        {this.props.children}
      </RelativeFloatingBox>
    )
  }
}

export default FloatingBox
