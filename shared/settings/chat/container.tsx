import * as SettingsGen from '../../actions/settings-gen'
import * as I from 'immutable'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import Chat from '.'

type OwnProps = {}

export default Container.namedConnect(
  state => {
    const whitelist = state.settings.chat.unfurl.unfurlWhitelist
    const unfurlWhitelist = whitelist ? whitelist.toArray() : []
    return {
      title: 'Chat',
      unfurlError: state.settings.chat.unfurl.unfurlError,
      unfurlMode: state.settings.chat.unfurl.unfurlMode,
      unfurlWhitelist,
    }
  },
  dispatch => ({
    onBack: Container.isMobile ? () => dispatch(RouteTreeGen.createNavigateUp()) : undefined,
    onRefresh: () => dispatch(SettingsGen.createUnfurlSettingsRefresh()),
    onUnfurlSave: (mode: RPCChatTypes.UnfurlMode, whitelist: Array<string>) =>
      dispatch(SettingsGen.createUnfurlSettingsSaved({mode, whitelist: I.List(whitelist)})),
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d}),
  'Chat'
)(Chat)
