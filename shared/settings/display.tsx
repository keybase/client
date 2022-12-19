import * as React from 'react'
import * as ConfigGen from '../actions/config-gen'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Container from '../util/container'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import {isDarkModeSystemSupported, type DarkModePreference} from '../styles/dark-mode'
import logger from '../logger'

const Display = () => {
  const allowAnimatedEmojis = Container.useSelector(state => state.config.allowAnimatedEmojis)
  const darkModePreference = Container.useSelector(state => state.config.darkModePreference)
  const toggleAnimatedEmoji = Container.useRPC(RPCChatTypes.localToggleEmojiAnimationsRpcPromise)
  const dispatch = Container.useDispatch()
  const onSetDarkModePreference = React.useCallback(
    (preference: DarkModePreference) => dispatch(ConfigGen.createSetDarkModePreference({preference})),
    [dispatch]
  )
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
            {isDarkModeSystemSupported() && (
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

Display.navigationOptions = {
  header: undefined,
  title: 'Display',
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
