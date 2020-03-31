import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {DarkModePreference, isDarkModeSystemSupported} from '../../styles/dark-mode'

type Props = {
  darkModePreference: DarkModePreference
  onBack: () => void
  onSetDarkModePreference: (pref: DarkModePreference) => void
}

const Display = (props: Props) => (
  <Kb.HeaderHocWrapper onBack={props.onBack} skipHeader={!Styles.isPhone} title="Display">
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
      </Kb.Box>
    </Kb.ScrollView>
  </Kb.HeaderHocWrapper>
)

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    flex: 1,
    padding: Styles.globalMargins.small,
    width: '100%',
  },
  scrollview: {
    width: '100%',
  },
}))

export default Display
