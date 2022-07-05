import React from 'react'
import ClickableBox from './clickable-box'
import Text from './text'
import * as Styles from '../styles'
import {Props} from './radio-button'

const Kb = {
  ClickableBox,
  Text,
}

export const RADIOBUTTON_SIZE = 22
export const RADIOBUTTON_MARGIN = 8

type ExtraProps = {disabled?: boolean; selected: boolean}
const RadioOuterCircle = Styles.styled<typeof ClickableBox, ExtraProps>(ClickableBox)(
  () => ({
    backgroundColor: Styles.globalColors.white,
    borderRadius: 100,
    borderWidth: 1,
    height: RADIOBUTTON_SIZE,
    marginRight: RADIOBUTTON_MARGIN,
    position: 'relative' as 'relative',
    width: RADIOBUTTON_SIZE,
  }),
  ({disabled, selected}) => ({
    borderColor: selected ? Styles.globalColors.blue : Styles.globalColors.black_20,
    opacity: disabled ? 0.4 : 1,
  })
)

const RadioInnerCircle = Styles.styled<typeof ClickableBox, ExtraProps>(ClickableBox)(
  () => ({
    borderColor: Styles.globalColors.white,
    borderRadius: 10,
    borderWidth: 5,
    left: 5,
    position: 'absolute',
    top: 5,
  }),
  ({selected}) => ({
    borderColor: selected ? Styles.globalColors.blue : Styles.globalColors.white,
  })
)

const RadioButton = ({disabled, label, onSelect, selected, style}: Props) => (
  <Kb.ClickableBox
    style={{...styles.container, ...style}}
    onClick={disabled ? undefined : () => onSelect(!selected)}
  >
    <RadioOuterCircle disabled={disabled} selected={selected}>
      <RadioInnerCircle selected={selected} />
    </RadioOuterCircle>
    {typeof label === 'string' ? (
      <Kb.Text type="Body" style={{color: Styles.globalColors.black}}>
        {label}
      </Kb.Text>
    ) : (
      label
    )}
  </Kb.ClickableBox>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        paddingBottom: Styles.globalMargins.xtiny,
        paddingTop: Styles.globalMargins.xtiny,
      },
    } as const)
)

export default RadioButton
