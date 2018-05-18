// @flow
import * as React from 'react'
import Box from './box'
import {TouchableOpacity, TouchableWithoutFeedback} from 'react-native'
import {collapseStyles, globalColors} from '../styles'

type Props = {
  className?: ?string,
  children?: any,
  style?: StylesCrossPlatform,
  onClick?: ?(event: SyntheticEvent<Element>) => void,
  onPress?: void,
  onLongPress?: ?(event: SyntheticEvent<Element>) => void,
  underlayColor?: ?string,
  onPressIn?: ?() => void,
  onPressOut?: ?() => void,
  feedback?: boolean,
  // mobile only
  activeOpacity?: number,
  // desktop only
  hoverColor?: ?string,
  onMouseOver?: ?(event: SyntheticEvent<>) => void,
  onMouseEnter?: ?() => void,
  onMouseLeave?: ?() => void,
  onMouseDown?: ?() => void,
  onMouseUp?: ?() => void,
}

const ClickableBox = ({
  onClick,
  onLongPress,
  style,
  children,
  underlayColor,
  onPressIn,
  onPressOut,
  feedback = true,
}: Props) => {
  if (onClick) {
    const clickStyle = style ? collapseStyles([boxStyle, style]) : boxStyle
    if (feedback) {
      return (
        <TouchableOpacity
          disabled={!onClick}
          onPress={onClick}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onLongPress={onLongPress}
          style={clickStyle}
          underlayColor={underlayColor || globalColors.white}
          activeOpacity={0.7}
        >
          {children}
        </TouchableOpacity>
      )
    } else {
      return (
        <TouchableWithoutFeedback
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={clickStyle}
          onPress={onClick}
          onLongPress={onLongPress}
        >
          {children}
        </TouchableWithoutFeedback>
      )
    }
  } else {
    return <Box style={style}>{children}</Box>
  }
}

const boxStyle = {
  borderRadius: 3,
}

export default ClickableBox
