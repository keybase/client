import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import logger from '@/logger'
import {useConfigState} from '@/stores/config'
import * as DarkMode from '@/stores/darkmode'

const Display = () => {
  const allowAnimatedEmojis = useConfigState(s => s.allowAnimatedEmojis)
  const forceSmallNav = useConfigState(s => s.forceSmallNav)
  const setForceSmallNav = useConfigState(s => s.dispatch.setForceSmallNav)
  const toggleForceSmallNav = React.useCallback(() => {
    setForceSmallNav(!forceSmallNav)
  }, [forceSmallNav, setForceSmallNav])

  const darkModePreference = DarkMode.useDarkModeState(s => s.darkModePreference)
  const toggleAnimatedEmoji = C.useRPC(T.RPCChat.localToggleEmojiAnimationsRpcPromise)
  const supported = DarkMode.useDarkModeState(s => s.supported)
  const onSetDarkModePreference = DarkMode.useDarkModeState(s => s.dispatch.setDarkModePreference)
  const doToggleAnimatedEmoji = (enabled: boolean) => {
    toggleAnimatedEmoji(
      [{enabled}],
      () => {},
      error => {
        logger.info('Settings::Display: error toggling emoji animation: ' + error.message)
      }
    )
  }
  return (
    <Kb.ScrollView style={styles.scrollview}>
      <Kb.Box style={styles.container}>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="medium">
          <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
            <Kb.Text type="Header">Appearance</Kb.Text>
            {supported && (
              <Kb.RadioButton
                label="Respect system settings"
                selected={darkModePreference === 'system'}
                onSelect={() => onSetDarkModePreference('system')}
              />
            )}
            <Kb.RadioButton
              label="Dark"
              selected={darkModePreference === 'alwaysDark'}
              onSelect={() => onSetDarkModePreference('alwaysDark')}
            />
            <Kb.RadioButton
              label={<Kb.Text type="Body">Light</Kb.Text>}
              selected={darkModePreference === 'alwaysLight'}
              onSelect={() => onSetDarkModePreference('alwaysLight')}
            />
          </Kb.Box2>
          <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
            <Kb.Text type="Header">Emoji</Kb.Text>
            <Kb.Checkbox
              label="Allow animated emoji"
              checked={allowAnimatedEmojis}
              onCheck={doToggleAnimatedEmoji}
            />
          </Kb.Box2>
          {C.isElectron && (
            <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
              <Kb.Text type="Header">Navigation</Kb.Text>
              <Kb.Checkbox
                label="Force small navigation"
                checked={forceSmallNav}
                onCheck={toggleForceSmallNav}
              />
            </Kb.Box2>
          )}
        </Kb.Box2>
      </Kb.Box>
    </Kb.ScrollView>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    ...Kb.Styles.globalStyles.flexBoxColumn,
    flex: 1,
    padding: Kb.Styles.globalMargins.small,
    width: '100%',
  },
  scrollview: {
    width: '100%',
  },
}))

export default Display
