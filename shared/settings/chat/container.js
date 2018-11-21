// @flow
import * as SettingsGen from '../../actions/settings-gen'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import {namedConnect} from '../../util/container'
import Chat from '.'

type OwnProps = {||}

const mapStateToProps = (state, ownProps: {}) => ({
  ...state.settings.chat.unfurl,
})

const mapDispatchToProps = (dispatch: any, ownProps: {}) => ({
  onUnfurlSave: (mode: RPCChatTypes.UnfurlMode, whitelist: Array<string>) =>
    dispatch(SettingsGen.createUnfurlSettingsSaved({mode, whitelist})),
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d}),
  'Chat'
)(Chat)
