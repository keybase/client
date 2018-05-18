// @flow
import * as React from 'react'
import {findDOMNode} from 'react-dom'
import {Box} from './box'
import {ModalPositionRelative} from './relative-popup-hoc.desktop'
import type {Position} from './relative-popup-hoc'
import type {StylesCrossPlatform} from '../styles'

type Props = {
  children?: React.Node,
  onHidden: () => void, // will be triggered automatically only on click/tap outside the box
  // gatewayID: string, TODO
  // Desktop only - the node that we should aim for
  // optional because desktop only, nullable because refs always are
  attachTo?: ?React.Component<any, any>,
  // Desktop only - allow clicks outside the floating box to propagate
  propagateOutsideClicks?: boolean,
  containerStyle?: StylesCrossPlatform,
  position?: Position,
}

const StyleOnlyBox = (props: any) => <Box style={props.style} children={props.children} />
const RelativeFloatingBox = ModalPositionRelative(StyleOnlyBox)

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
    return (
      <RelativeFloatingBox
        position={this.props.position || 'bottom center'}
        targetRect={this.state.targetRect}
        onClosePopup={this.props.onHidden}
        propagateOutsideClicks={this.props.propagateOutsideClicks}
        style={this.props.containerStyle}
      >
        {this.props.children}
      </RelativeFloatingBox>
    )
  }
}

export default FloatingBox
