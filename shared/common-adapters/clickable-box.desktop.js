// @flow
import * as React from 'react'
import {collapseStyles, globalStyles, desktopStyles} from '../styles'

import type {Props} from './clickable-box'

const needMouseEnterLeaveHandlers = (props: Props): boolean => {
  return !!(props.hoverColor || props.underlayColor || props.onMouseEnter || props.onMouseLeave)
}

class ClickableBox extends React.Component<Props & {children: any}, {mouseDown: boolean, mouseIn: boolean}> {
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
    const {style, children, underlayColor, hoverColor, onClick, onDoubleClick, ...otherProps} = this.props

    // filter out native-only calls
    const {onPress, onLongPress, onPressIn, onPressOut, ...passThroughProps} = otherProps

    let underlay

    if (this.state.mouseIn) {
      let borderRadius = 0
      if (style && typeof style === 'object') {
        borderRadius = style.borderRadius || 0
      }
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
        {...passThroughProps}
        onMouseDown={this._onMouseDown}
        // Set onMouseEnter/Leave only if needed, so that any hover
        // properties of children elements work.
        onMouseEnter={needMouseEnterLeaveHandlers(this.props) ? this._onMouseEnter : undefined}
        onMouseLeave={needMouseEnterLeaveHandlers(this.props) ? this._onMouseLeave : undefined}
        onMouseUp={this._onMouseUp}
        onDoubleClick={onDoubleClick}
        onClick={onClick}
        style={collapseStyles([_containerStyle, onClick ? desktopStyles.clickable : null, style])}
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
