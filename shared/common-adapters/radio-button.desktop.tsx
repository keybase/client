import * as React from 'react'
import * as Styles from '../styles'
import Text from './text'
import {Props} from './radio-button'

const Kb = {
  Text,
}

export const RADIOBUTTON_SIZE = 14
export const RADIOBUTTON_MARGIN = 8

const StyledRadio: any = Styles.styled.div(
  () => ({
    ...Styles.transition('background'),
    borderRadius: '100%',
    flex: 'none',
    height: RADIOBUTTON_SIZE,
    marginRight: RADIOBUTTON_MARGIN,
    position: 'relative',
    width: RADIOBUTTON_SIZE,
  }),
  // @ts-ignore
  ({disabled, selected}) => ({
    '&:hover': {border: (selected || !disabled) && `solid 1px ${Styles.globalColors.blue}`},
    backgroundColor: selected ? Styles.globalColors.blue : 'inherit',
    border: `solid 1px ${Styles.globalColors.black_20}`,
    opacity: disabled ? 0.4 : 1,
  })
)

const RadioButton = ({disabled, label, onSelect, selected, style}: Props) => (
  <div
    style={{...styles.container, ...(disabled ? {} : Styles.desktopStyles.clickable), ...style}}
    onClick={disabled ? undefined : () => onSelect(!selected)}
  >
    <StyledRadio disabled={disabled} selected={selected}>
      <div style={styles.radio as any} />
    </StyledRadio>
    <Kb.Text type="Body" style={{color: Styles.globalColors.black}}>
      {label}
    </Kb.Text>
  </div>
)

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
  },
  radio: {
    ...Styles.transition('opacity'),
    border: `solid 3px ${Styles.globalColors.white}`,
    borderRadius: 100,
    color: Styles.globalColors.white,
    hoverColor: Styles.globalColors.white,
    left: 3,
    position: 'absolute',
    top: 3,
  },
}))

export default RadioButton
