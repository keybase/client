// @flow
import React from 'react'
import {globalStyles} from '../styles'

import type {Props} from './clickable-box'

class ClickableBox
  extends React.Component<void, Props & {children: any}, {mouseDown: boolean, mouseIn: boolean}> {
  state = {
    mouseDown: false,
    mouseIn: false,
  }
  _onMouseEnter = () => {
    this.setState({mouseIn: true})
    this.props.onMouseEnter && this.props.onMouseEnter()
  }
  _onMouseLeave = () => {
    this.setState({mouseIn: false})
    this.props.onMouseLeave && this.props.onMouseLeave()
  }
  _onMouseDown = () => {
    this.setState({mouseDown: true})
    this.props.onMouseDown && this.props.onMouseDown()
  }
  _onMouseUp = () => {
    this.setState({mouseDown: false})
    this.props.onMouseUp && this.props.onMouseUp()
  }

  render() {
    const {style, children, underlayColor, hoverColor, onClick, ...otherProps} = this.props

    // div on desktop doesn't support onLongPress, but we allow the common
    // ClickableBox component to pass one down for mobile, so strip it out here.
    if (otherProps.onLongPress) {
      delete otherProps.onLongPress
    }

    let underlay

    // if (true) {
    if (this.state.mouseIn) {
      const borderRadius = style && style.borderRadius
      // Down or hover
      const backgroundColor = this.state.mouseDown
        ? underlayColor || 'rgba(255, 255, 255, 0.2)'
        : hoverColor || 'rgba(255, 255, 255, 0.1)'
      underlay = (
        <div
          style={{
            ...globalStyles.fillAbsolute,
            backgroundColor,
            borderRadius,
          }}
        />
      )
    }

    return (
      <div
        {...otherProps}
        onMouseDown={this._onMouseDown}
        onMouseEnter={this._onMouseEnter}
        onMouseLeave={this._onMouseLeave}
        onMouseUp={this._onMouseUp}
        onClick={onClick}
        style={{..._containerStyle, ...(onClick ? globalStyles.clickable : null), ...style}}
      >
        {underlay}
        {children}
      </div>
    )
  }
}

const _containerStyle = {
  alignItems: 'stretch',
  borderRadius: 0,
  display: 'flex',
  flexDirection: 'column',
  height: undefined,
  lineHeight: 0,
  minWidth: undefined,
  textAlign: 'left',
  transform: 'none',
  transition: 'none',
  position: 'relative',
}

export default ClickableBox
