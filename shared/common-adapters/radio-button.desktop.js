// @flow
import * as React from 'react'
import Text from './text'
import glamorous from 'glamorous'
import type {Props} from './radio-button'
import {globalStyles, globalColors, transition} from '../styles'

export const RADIOBUTTON_SIZE = 14
export const RADIOBUTTON_MARGIN = 8

const RadioButton = ({disabled, label, onSelect, selected, style}: Props) => {
  const clickableStyle = disabled ? {} : globalStyles.clickable

  const StyledDiv = glamorous(glamorous.Div)(({border, disabled, selected}) => ({
    '&:hover': {border: (selected || !disabled) && `solid 1px ${globalColors.blue}`},
    border: `solid 1px ${globalColors.black_10}`,
  }))

  StyledDiv.defaultProps = {
    ...transition('background'),
    backgroundColor: selected ? globalColors.blue : 'inherit',
    borderRadius: '100%',
    height: RADIOBUTTON_SIZE,
    marginRight: RADIOBUTTON_MARGIN,
    opacity: disabled ? 0.4 : 1,
    position: 'relative',
    width: RADIOBUTTON_SIZE,
  }

  return (
    <div
      style={{...styleContainer, ...clickableStyle, ...style}}
      onClick={disabled ? undefined : () => onSelect(!selected)}
    >
      <StyledDiv disabled={disabled} selected={selected}>
        <div style={styleIcon} />
      </StyledDiv>
      <Text type="Body" style={{color: globalColors.black_75}}>{label}</Text>
    </div>
  )
}

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
