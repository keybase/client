// @flow
import * as React from 'react'
import Text from './text'
import glamorous from 'glamorous'
import type {Props} from './radio-button'
import {globalStyles, globalColors, transition, desktopStyles} from '../styles'

export const RADIOBUTTON_SIZE = 14
export const RADIOBUTTON_MARGIN = 8

const StyledRadio = glamorous(glamorous.Div)(
  {
    ...transition('background'),
    borderRadius: '100%',
    height: RADIOBUTTON_SIZE,
    marginRight: RADIOBUTTON_MARGIN,
    position: 'relative',
    width: RADIOBUTTON_SIZE,
  },
  ({disabled, selected}) => ({
    '&:hover': {border: (selected || !disabled) && `solid 1px ${globalColors.blue}`},
    backgroundColor: selected ? globalColors.blue : 'inherit',
    border: `solid 1px ${globalColors.black_10}`,
    opacity: disabled ? 0.4 : 1,
  })
)

const RadioButton = ({disabled, label, onSelect, selected, style}: Props) => (
  <div
    style={{...styleContainer, ...(disabled ? {} : desktopStyles.clickable), ...style}}
    onClick={disabled ? undefined : () => onSelect(!selected)}
  >
    <StyledRadio disabled={disabled} selected={selected}>
      <div style={styleIcon} />
    </StyledRadio>
    <Text type="Body" style={{color: globalColors.black_75}}>
      {label}
    </Text>
  </div>
)

const styleContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
}

const styleIcon = {
  ...transition('opacity'),
  border: `solid 3px ${globalColors.white}`,
  borderRadius: '100%',
  color: globalColors.white,
  hoverColor: globalColors.white,
  left: 3,
  position: 'absolute',
  top: 3,
}

export default RadioButton
