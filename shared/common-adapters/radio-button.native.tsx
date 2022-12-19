import * as React from 'react'
import ClickableBox from './clickable-box'
import Text from './text'
import * as Styles from '../styles'
import type {Props} from './radio-button'

const Kb = {
  ClickableBox,
  Text,
}

export const RADIOBUTTON_SIZE = 22
export const RADIOBUTTON_MARGIN = 8

const RadioOuterCircle = (p: {disabled: boolean; selected: boolean; children: React.ReactNode}) => (
  <Kb.ClickableBox
    style={Styles.collapseStyles([
      styles.outer,
      {
        borderColor: p.selected ? Styles.globalColors.blue : Styles.globalColors.black_20,
        opacity: p.disabled ? 0.4 : 1,
      },
    ])}
  >
    {p.children}
  </Kb.ClickableBox>
)

const RadioInnerCircle = (p: {selected: boolean}) => (
  <Kb.ClickableBox
    style={Styles.collapseStyles([
      styles.inner,
      {borderColor: p.selected ? Styles.globalColors.blue : Styles.globalColors.white},
    ])}
  />
)

const RadioButton = ({disabled, label, onSelect, selected, style}: Props) => (
  <Kb.ClickableBox
    style={{...styles.container, ...style}}
    onClick={disabled ? undefined : () => onSelect(!selected)}
  >
    <RadioOuterCircle disabled={disabled ?? false} selected={selected}>
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
      inner: {
        borderColor: Styles.globalColors.white,
        borderRadius: 10,
        borderWidth: 5,
        left: 5,
        position: 'absolute',
        top: 5,
      },
      outer: {
        backgroundColor: Styles.globalColors.white,
        borderRadius: 100,
        borderWidth: 1,
        height: RADIOBUTTON_SIZE,
        marginRight: RADIOBUTTON_MARGIN,
        position: 'relative' as const,
        width: RADIOBUTTON_SIZE,
      },
    } as const)
)

export default RadioButton
