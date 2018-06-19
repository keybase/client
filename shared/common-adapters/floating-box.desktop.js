// @flow
import * as React from 'react'
import {findDOMNode} from 'react-dom'
import {Box} from './box'
import {ModalPositionRelative} from './relative-popup-hoc.desktop'
import type {Props} from './floating-box'

const StyleOnlyBox = (props: any) => <Box children={props.children} />
const RelativeFloatingBox = ModalPositionRelative(StyleOnlyBox)

type State = {
  targetRect: ?React.Component<any, any>,
}

class FloatingBox extends React.Component<Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {
      targetRect: this._getTargetRect(props),
    }
  }

  _getTargetRect = (p: Props) => {
    let targetRect = null
    if (this.props.attachTo) {
      const node = findDOMNode(this.props.attachTo)
      if (node instanceof window.HTMLElement) {
        targetRect = node.getBoundingClientRect()
      }
    }
    return targetRect
  }

  _onHidden = () => {
    this.props.onHidden && this.props.onHidden()
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.attachTo !== prevProps.attachTo) {
      const targetRect = this._getTargetRect(this.props)
      this.setState(p => (p.targetRect !== targetRect ? {targetRect} : null))
    }
  }

  render() {
    return (
      <RelativeFloatingBox
        position={this.props.position || 'bottom center'}
        targetRect={this.state.targetRect}
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
