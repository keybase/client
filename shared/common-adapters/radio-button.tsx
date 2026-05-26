import {View} from 'react-native'
import ClickableBox from './clickable-box'
import Text from './text'
import * as Styles from '@/styles'
import './radio-button.css'
import type * as React from 'react'

type Props = {
  label: string | React.ReactNode
  onSelect: (selected: boolean) => void
  selected: boolean
  style?: object
  disabled?: boolean
}

const Kb = {
  ClickableBox,
  Text,
}

export const RADIOBUTTON_SIZE = 22
export const RADIOBUTTON_MARGIN = 8

const RadioButton = ({disabled, label, onSelect, selected, style}: Props) => {
  if (!isMobile) {
    return (
      <div
        style={{...desktopStyles.container, ...(disabled ? {} : Styles.desktopStyles.clickable), ...style}}
        onClick={disabled ? undefined : () => onSelect(!selected)}
      >
        <div className={Styles.classNames('radio-button', {disabled, selected})}>
          <div style={Styles.castStyleDesktop(desktopStyles.radio)} />
        </div>
        <Kb.Text type="Body" style={{color: Styles.globalColors.black}}>
          {label}
        </Kb.Text>
      </div>
    )
  }
  return (
    <Kb.ClickableBox
      style={{...nativeStyles.container, ...style}}
      onClick={disabled ? undefined : () => onSelect(!selected)}
    >
      <View
        style={Styles.collapseStyles([
          nativeStyles.outer,
          {
            borderColor: selected ? Styles.globalColors.blue : Styles.globalColors.black_20,
            opacity: disabled ? 0.4 : 1,
          },
        ])}
      >
        <View
          style={Styles.collapseStyles([
            nativeStyles.inner,
            {borderColor: selected ? Styles.globalColors.blue : Styles.globalColors.transparent},
          ])}
        />
      </View>
      {typeof label === 'string' ? (
        <Kb.Text type="Body" style={{color: Styles.globalColors.black}}>
          {label}
        </Kb.Text>
      ) : (
        label
      )}
    </Kb.ClickableBox>
  )
}

const desktopStyles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
  },
  radio: Styles.platformStyles({
    isElectron: {
      ...Styles.transition('opacity'),
      border: `solid 3px ${Styles.globalColors.white}`,
      borderRadius: 100,
      color: Styles.globalColors.white,
      hoverColor: Styles.globalColors.white,
      left: 3,
      position: 'absolute',
      top: 3,
    },
  }),
}))

const nativeStyles = Styles.styleSheetCreate(
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
    }) as const
)

export default RadioButton
