import * as React from 'react'
import {collapseStyles, globalStyles, desktopStyles} from '../styles'

import {Props} from './clickable-box'
import {_StylesCrossPlatform} from '../styles/css'

const needMouseEnterLeaveHandlers = (props: Props): boolean => {
  return !!(props.hoverColor || props.underlayColor || props.onMouseEnter || props.onMouseLeave)
}

class ClickableBox extends React.Component<
  Props & {children: React.ReactNode},
  {mouseDown: boolean; mouseIn: boolean}
> {
  state = {
    mouseDown: false,
    mouseIn: false,
  }
  _onMouseEnter = e => {
    this.setState({mouseIn: true})
    this.props.onMouseEnter && this.props.onMouseEnter(e)
  }
  _onMouseLeave = e => {
    this.setState({mouseIn: false})
    this.props.onMouseLeave && this.props.onMouseLeave(e)
  }
  _onMouseDown = e => {
    this.setState({mouseDown: true})
    this.props.onMouseDown && this.props.onMouseDown(e)
  }
  _onMouseUp = e => {
    this.setState({mouseDown: false})
    this.props.onMouseUp && this.props.onMouseUp(e)
  }

  render() {
    const {style, children, underlayColor, hoverColor, onClick, onDoubleClick, ...otherProps} = this.props

    // filter out native-only calls
    const {onPress, onLongPress, onPressIn, onPressOut, ...passThroughProps} = otherProps

    let underlay

    if (this.state.mouseIn && this.props.onClick) {
      let borderRadius = 0
      if (style && typeof style === 'object') {
        borderRadius = (style as _StylesCrossPlatform).borderRadius || 0
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
        onDoubleClick={onDoubleClick || undefined}
        onClick={onClick || undefined}
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
  position: 'relative',
  textAlign: 'left',
  transform: 'none',
  transition: 'none',
}

export default ClickableBox
