// @flow
import React from 'react'
import ClickableBox from './clickable-box'
import Text from './text'
import type {Props} from './radio-button'
import {globalStyles, globalColors} from '../styles'

export const RADIOBUTTON_SIZE = 22
export const RADIOBUTTON_MARGIN = 8

const RadioButton = ({disabled, label, onSelect, selected, style}: Props) => {
  const boxStyle = {
    backgroundColor: globalColors.white,
    border: 1,
    borderColor: selected ? globalColors.blue : globalColors.black_10,
    borderRadius: 100,
    borderWidth: 1,
    height: RADIOBUTTON_SIZE,
    marginRight: RADIOBUTTON_MARGIN,
    opacity: disabled ? 0.4 : 1,
    position: 'relative',
    width: RADIOBUTTON_SIZE,
  }

  return (
    <ClickableBox
      style={{...styleContainer, ...style}}
      onClick={disabled ? undefined : () => onSelect(!selected)}
    >
      <ClickableBox style={boxStyle}>
        <ClickableBox
          style={{...styleIcon, borderColor: selected ? globalColors.blue : globalColors.white}}
        />
      </ClickableBox>
      <Text type="Body" style={{color: globalColors.black_75}}>{label}</Text>
    </ClickableBox>
  )
}

const styleContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
}

const styleIcon = {
  borderWidth: 5,
  borderColor: globalColors.white,
  borderRadius: 10,
  left: 5,
  position: 'absolute',
  top: 5,
}

export default RadioButton
