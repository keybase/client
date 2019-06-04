import * as React from 'react'
import {Props} from './clickable-box'
import Box from './box'
import {TouchableOpacity, TouchableWithoutFeedback} from 'react-native'
import {collapseStyles, globalColors} from '../styles'

class ClickableBox extends React.Component<Props> {
  render() {
    const props = this.props
    const {feedback = true} = props
    if (props.onClick) {
      const clickStyle = collapseStyles([boxStyle, props.style])
      if (feedback) {
        return (
          <TouchableOpacity
            disabled={!props.onClick}
            onPress={props.onClick}
            onPressIn={props.onPressIn}
            onPressOut={props.onPressOut}
            onLongPress={props.onLongPress}
            pointerEvents={props.pointerEvents}
            style={clickStyle}
            underlayColor={props.underlayColor || globalColors.white}
            activeOpacity={
              // Auto generated from flowToTs. Please clean me!
              this.props.activeOpacity !== null && this.props.activeOpacity !== undefined
                ? this.props.activeOpacity
                : 0.7
            }
          >
            {props.children}
          </TouchableOpacity>
        )
      } else {
        return (
          <TouchableWithoutFeedback
            onPressIn={props.onPressIn}
            onPressOut={props.onPressOut}
            style={clickStyle}
            onPress={props.onClick}
            pointerEvents={props.pointerEvents}
            onLongPress={props.onLongPress}
          >
            {props.children}
          </TouchableWithoutFeedback>
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
