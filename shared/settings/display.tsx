import * as C from '../constants'
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Container from '../util/container'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import logger from '../logger'

const Display = () => {
  const allowAnimatedEmojis = C.useConfigState(s => s.allowAnimatedEmojis)
  const darkModePreference = C.useDarkModeState(s => s.darkModePreference)
  const toggleAnimatedEmoji = Container.useRPC(RPCChatTypes.localToggleEmojiAnimationsRpcPromise)
  const supported = C.useDarkModeState(s => s.supported)
  const onSetDarkModePreference = C.useDarkModeState(s => s.dispatch.setDarkModePreference)
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
                selected={darkModePreference === 'system' || darkModePreference === undefined}
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
        </Kb.Box2>
      </Kb.Box>
    </Kb.ScrollView>
  )
}

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
