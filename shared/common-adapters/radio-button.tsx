import {View} from 'react-native'
import {ClickableBox} from './box'
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

const RADIOBUTTON_SIZE = 22

const RadioButton = ({disabled, label, onSelect, selected, style}: Props) => {
  const desktopStyles = useDesktopStyles()
  const nativeStyles = useNativeStyles()
  const theme = Styles.useTheme()
  if (!isMobile) {
    return (
      <div
        style={{...desktopStyles.container, ...(disabled ? {} : Styles.desktopStyles.clickable), ...style}}
        onClick={disabled ? undefined : () => onSelect(!selected)}
      >
        <div className={Styles.classNames('radio-button', {disabled, selected})}>
          <div style={Styles.castStyleDesktop(desktopStyles.radio)} />
        </div>
        <Kb.Text type="Body" style={{color: theme.black}}>
          {label}
        </Kb.Text>
      </div>
    )
  }
  return (
    <Kb.ClickableBox
      direction="horizontal"
      alignItems="center"
      gap="tiny"
      style={Styles.collapseStyles([nativeStyles.container, style])}
      onClick={disabled ? undefined : () => onSelect(!selected)}
    >
      <View
        style={Styles.collapseStyles([
          nativeStyles.outer,
          {
            borderColor: selected ? theme.blue : theme.black_20,
            opacity: disabled ? 0.4 : 1,
          },
        ])}
      >
        <View
          style={Styles.collapseStyles([
            nativeStyles.inner,
            {borderColor: selected ? theme.blue : theme.transparent},
          ])}
        />
      </View>
      {typeof label === 'string' ? (
        <Kb.Text type="Body" style={{color: theme.black}}>
          {label}
        </Kb.Text>
      ) : (
        label
      )}
    </Kb.ClickableBox>
  )
}

const useDesktopStyles = Styles.createStyleHook(theme => ({
  container: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    gap: 8,
  },
  radio: Styles.platformStyles({
    isElectron: {
      ...Styles.transition('opacity'),
      border: `solid 3px ${theme.white}`,
      borderRadius: 100,
      color: theme.white,
      hoverColor: theme.white,
      left: 3,
      position: 'absolute',
      top: 3,
    },
  }),
}))

const useNativeStyles = Styles.createStyleHook(
  theme =>
    ({
      container: {
        ...Styles.paddingV(Styles.globalMargins.xtiny),
        alignSelf: 'flex-start',
      },
      inner: {
        borderColor: theme.white,
        borderRadius: 10,
        borderWidth: 5,
        left: 5,
        position: 'absolute',
        top: 5,
      },
      outer: {
        ...Styles.size(RADIOBUTTON_SIZE),
        backgroundColor: theme.white,
        borderRadius: 100,
        borderWidth: 1,
        position: 'relative' as const,
      },
    }) as const
)

export default RadioButton
