import * as React from 'react'
import {Props} from './clickable-box'
import Box from './box'
import {NativeTouchableOpacity, NativeTouchableWithoutFeedback} from './native-wrappers.native'
import {collapseStyles} from '../styles'

class ClickableBox extends React.Component<Props> {
  render() {
    const props = this.props
    const {feedback = true} = props
    if (props.onClick) {
      const clickStyle = collapseStyles([boxStyle, props.style])
      if (feedback) {
        return (
          <NativeTouchableOpacity
            disabled={!props.onClick}
            onPress={props.onClick}
            onPressIn={props.onPressIn}
            onPressOut={props.onPressOut}
            onLongPress={props.onLongPress}
            style={clickStyle}
            activeOpacity={
              // Auto generated from flowToTs. Please clean me!
              this.props.activeOpacity !== null && this.props.activeOpacity !== undefined
                ? this.props.activeOpacity
                : 0.7
            }
          >
            {props.children}
          </NativeTouchableOpacity>
        )
      } else {
        return (
          <NativeTouchableWithoutFeedback
            onPressIn={props.onPressIn}
            onPressOut={props.onPressOut}
            style={clickStyle}
            onPress={props.onClick}
            onLongPress={props.onLongPress}
          >
            {props.children}
          </NativeTouchableWithoutFeedback>
        )
      }
    } else {
      return (
        <Box style={props.style} pointerEvents={props.pointerEvents}>
          {props.children}
        </Box>
      )
    }
  }
}

const boxStyle = {
  borderRadius: 3,
}

export default ClickableBox
