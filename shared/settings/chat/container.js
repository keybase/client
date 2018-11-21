// @flow
import * as SettingsGen from '../../actions/settings-gen'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import {namedConnect} from '../../util/container'
import {navigateUp} from '../../actions/route-tree'
import {isMobile} from '../../styles'
import Chat from '.'

type OwnProps = {||}

const mapStateToProps = (state, ownProps: {}) => ({
  ...state.settings.chat.unfurl,
  title: 'Chat',
})

const mapDispatchToProps = (dispatch: any, ownProps: {}) => ({
  onBack: isMobile ? () => dispatch(navigateUp()) : undefined,
  onUnfurlSave: (mode: RPCChatTypes.UnfurlMode, whitelist: Array<string>) =>
    dispatch(SettingsGen.createUnfurlSettingsSaved({mode, whitelist})),
  onRefresh: () => dispatch(SettingsGen.createUnfurlSettingsRefresh()),
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d}),
  'Chat'
)(Chat)
