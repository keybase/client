// @flow
import React from 'react'
import ClickableBox from './clickable-box'
import Text from './text'
import glamorous from 'glamorous-native'
import {globalStyles, globalColors, globalMargins} from '../styles'

import type {Props} from './radio-button'

export const RADIOBUTTON_SIZE = 22
export const RADIOBUTTON_MARGIN = 8

const RadioOuterCircle = glamorous(ClickableBox)(
  {
    backgroundColor: globalColors.white,
    borderRadius: 100,
    borderWidth: 1,
    height: RADIOBUTTON_SIZE,
    marginRight: RADIOBUTTON_MARGIN,
    position: 'relative',
    width: RADIOBUTTON_SIZE,
  },
  ({disabled, selected}) => ({
    borderColor: selected ? globalColors.blue : globalColors.black_10,
    opacity: disabled ? 0.4 : 1,
  })
)

const RadioInnerCircle = glamorous(ClickableBox)(
  {
    borderColor: globalColors.white,
    borderRadius: 10,
    borderWidth: 5,
    left: 5,
    position: 'absolute',
    top: 5,
  },
  ({selected}) => ({
    borderColor: selected ? globalColors.blue : globalColors.white,
  })
)

const RadioButton = ({disabled, label, onSelect, selected, style}: Props) => (
  <ClickableBox
    style={{...styleContainer, ...style}}
    onClick={disabled ? undefined : () => onSelect(!selected)}
  >
    <RadioOuterCircle disabled={disabled} selected={selected}>
      <RadioInnerCircle selected={selected} />
    </RadioOuterCircle>

    <Text type="Body" style={{color: globalColors.black_75}}>{label}</Text>
  </ClickableBox>
)

const styleContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  paddingBottom: globalMargins.xtiny,
  paddingTop: globalMargins.xtiny,
}

export default RadioButton
