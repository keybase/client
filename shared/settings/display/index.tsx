import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {DarkModePreference, isDarkModeSystemSupported} from '../../styles/dark-mode'
import {isMobile, isLinux} from '../../constants/platform'

type Props = {
  darkModePreference: DarkModePreference
  onBack: () => void
  onSetDarkModePreference: (pref: DarkModePreference) => void
  useNativeFrame: boolean
  onChangeUseNativeFrame: (use: boolean) => void
}

let initialUseNativeFrame: boolean | undefined

const UseNativeFrame = (props: Props) => {
  if (initialUseNativeFrame === undefined) {
    initialUseNativeFrame = props.useNativeFrame
  }
  return isMobile ? null : (
    <>
      <Kb.Box style={styles.checkboxContainer}>
        <Kb.Checkbox
          checked={!props.useNativeFrame}
          label="Hide system window frame"
          onCheck={x => props.onChangeUseNativeFrame(!x)}
        />
      </Kb.Box>
      {initialUseNativeFrame !== props.useNativeFrame && (
        <Kb.Text type="BodySmall" style={styles.error}>
          Keybase needs to restart for this change to take effect.
        </Kb.Text>
      )}
    </>
  )
}

const Display = (props: Props) => (
  <Kb.ScrollView style={styles.scrollview}>
    <Kb.Box style={styles.container}>
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
          <Kb.Text type="Header">Appearance</Kb.Text>
          {isDarkModeSystemSupported() && (
            <Kb.RadioButton
              label="Respect system settings"
              selected={props.darkModePreference === 'system' || props.darkModePreference === undefined}
              onSelect={() => props.onSetDarkModePreference('system')}
            />
          )}
          <Kb.RadioButton
            label="Dark"
            selected={props.darkModePreference === 'alwaysDark'}
            onSelect={() => props.onSetDarkModePreference('alwaysDark')}
          />
          <Kb.RadioButton
            label={<Kb.Text type="Body">Light</Kb.Text>}
            selected={props.darkModePreference === 'alwaysLight'}
            onSelect={() => props.onSetDarkModePreference('alwaysLight')}
          />
        </Kb.Box2>
      </Kb.Box2>
      {isLinux ? <UseNativeFrame {...props} /> : null}
    </Kb.Box>
  </Kb.ScrollView>
)

const styles = Styles.styleSheetCreate(() => ({
  checkboxContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    paddingBottom: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.tiny,
    width: '100%',
  },
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    ...Styles.padding(Styles.globalMargins.small, Styles.globalMargins.medium),
    flex: 1,
    width: '100%',
  },
  scrollview: {
    width: '100%',
  },
  error: {
    color: Styles.globalColors.redDark,
  },
}))

export default Display
