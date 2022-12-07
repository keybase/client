import * as React from 'react'
import {findDOMNode} from 'react-dom'
import type {Props} from '.'
import logger from '../../logger'
import {RelativeFloatingBox} from './relative-floating-box.desktop'

type State = {
  targetRect: ClientRect | null
}

class FloatingBox extends React.PureComponent<Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {targetRect: this._getTargetRect()}
  }

  _getTargetRect = () => {
    let targetRect: ClientRect | null = null
    if (this.props.attachTo) {
      const attachTo = this.props.attachTo()
      if (attachTo instanceof HTMLElement) {
        return attachTo.getBoundingClientRect()
      }
      if (attachTo) {
        console.warn('Non html element passed to floating box, deprecate this soon')
        let node
        try {
          node = findDOMNode(attachTo)
        } catch (error_) {
          const error = error_ as any
          logger.error(`FloatingBox: unable to find rect to attach to. Error: ${error.message}`)
          return null
        }
        if (node instanceof HTMLElement) {
          targetRect = node.getBoundingClientRect()
        }
      }
    }
    return targetRect
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
