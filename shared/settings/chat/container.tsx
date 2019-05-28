import * as SettingsGen from '../../actions/settings-gen'
import * as I from 'immutable'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import {namedConnect} from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {isMobile} from '../../styles'
import Chat from '.'

type OwnProps = {}

const mapStateToProps = (state, ownProps: {}) => {
  const whitelist = state.settings.chat.unfurl.unfurlWhitelist
  const unfurlWhitelist = whitelist ? whitelist.toArray() : []
  return {
    title: 'Chat',
    unfurlError: state.settings.chat.unfurl.unfurlError,
    unfurlMode: state.settings.chat.unfurl.unfurlMode,
    unfurlWhitelist,
  }
}

const mapDispatchToProps = (dispatch: any, ownProps: {}) => ({
  onBack: isMobile ? () => dispatch(RouteTreeGen.createNavigateUp()) : undefined,
  onRefresh: () => dispatch(SettingsGen.createUnfurlSettingsRefresh()),
  onUnfurlSave: (mode: RPCChatTypes.UnfurlMode, whitelist: Array<string>) =>
    dispatch(SettingsGen.createUnfurlSettingsSaved({mode, whitelist: I.List(whitelist)})),
})

export default namedConnect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d}), 'Chat')(
  Chat
)
