// @flow
import * as React from 'react'
import {findDOMNode} from 'react-dom'
import {Box} from './box'
import {ModalPositionRelative} from './relative-popup-hoc.desktop'
import type {Props} from './floating-box'

const StyleOnlyBox = (props: any) => <Box children={props.children} />
const RelativeFloatingBox = ModalPositionRelative(StyleOnlyBox)

class FloatingBox extends React.Component<Props> {
  _onHidden = () => {
    this.props.onHidden && this.props.onHidden()
  }

  render() {
    let targetRect = null
    if (this.props.attachTo) {
      const node = findDOMNode(this.props.attachTo)
      if (node instanceof window.HTMLElement) {
        targetRect = node.getBoundingClientRect()
      }
    }

    return (
      <RelativeFloatingBox
        position={this.props.position || 'bottom center'}
        targetRect={targetRect}
        onClosePopup={this._onHidden}
        propagateOutsideClicks={this.props.propagateOutsideClicks}
        style={this.props.containerStyle}
      >
        {this.props.children}
      </RelativeFloatingBox>
    )
  }
}

export default FloatingBox
