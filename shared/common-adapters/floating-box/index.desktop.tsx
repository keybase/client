import * as React from 'react'
import type {Props} from '.'
import {RelativeFloatingBox} from './relative-floating-box.desktop'
import type {MeasureDesktop} from '@/common-adapters/measure-ref'

type State = {
  targetRect?: MeasureDesktop
}

class FloatingBox extends React.PureComponent<Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {targetRect: this._getTargetRect()}
  }

  _getTargetRect = () => {
    return this.props.attachTo?.current?.measure?.()
  }

  _onHidden = () => {
    this.props.onHidden && this.props.onHidden()
  }

  componentDidUpdate() {
    const targetRect = this._getTargetRect()
    this.setState(p => {
      if (p.targetRect === targetRect) {
        return null
      }
      if (!p.targetRect || !targetRect) {
        return {targetRect}
      }
      if (
        p.targetRect.left !== targetRect.left ||
        p.targetRect.top !== targetRect.top ||
        p.targetRect.width !== targetRect.width ||
        p.targetRect.height !== targetRect.height
      ) {
        return {targetRect}
      }
      return null
    })
  }

  render() {
    return (
      <RelativeFloatingBox
        disableEscapeKey={this.props.disableEscapeKey}
        position={this.props.position || 'bottom center'}
        positionFallbacks={this.props.positionFallbacks}
        targetRect={this.state.targetRect}
        matchDimension={!!this.props.matchDimension}
        onClosePopup={this._onHidden}
        remeasureHint={this.props.remeasureHint}
        propagateOutsideClicks={this.props.propagateOutsideClicks}
        style={this.props.containerStyle}
      >
        {this.props.children}
      </RelativeFloatingBox>
    )
  }
}

export default FloatingBox
