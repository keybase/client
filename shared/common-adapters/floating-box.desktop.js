// @flow
import * as React from 'react'
import {findDOMNode} from 'react-dom'
import {Box} from './box'
import {ModalPositionRelative} from './relative-popup-hoc.desktop'
import type {Props} from './floating-menu'

const RelativeFloatingMenu = ModalPositionRelative(Box)

type State = {
  targetRect: ?ClientRect,
}

class FloatingMenu extends React.Component<Props, State> {
  state = {targetRect: null}

  static getDerivedStateFromProps(nextProps: Props, prevState: State) {
    if (!nextProps.attachTo) {
      return {targetRect: null}
    }
    const node = findDOMNode(nextProps.attachTo)
    return {targetRect: node.getBoundingClientRect()}
  }

  render() {
    if (!this.props.visible) {
      return null
    }
    return (
      <RelativeFloatingMenu
        position={this.props.position || 'bottom center'}
        targetRect={this.state.targetRect}
        onClosePopup={this.props.onHidden}
      >
        {this.props.children}
      </RelativeFloatingMenu>
    )
  }
}

export default FloatingMenu
