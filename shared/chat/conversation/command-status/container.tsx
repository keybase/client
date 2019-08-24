import * as Types from '../../../constants/types/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as ConfigGen from '../../../actions/config-gen'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import {namedConnect, TypedDispatch, TypedState} from '../../../util/container'
import CommandStatus from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

const empty = {
  actions: [],
  displayText: '',
  displayType: RPCChatTypes.UICommandStatusDisplayTyp.error,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const info = state.chat2.commandStatusMap.get(ownProps.conversationIDKey)
  return {
    _info: info || empty,
  }
}

const mapDispatchToProps = (dispatch: TypedDispatch, ownProps: OwnProps) => ({
  _onOpenAppSettings: () => dispatch(ConfigGen.createOpenAppSettings()),
  onCancel: () =>
    dispatch(Chat2Gen.createClearCommandStatusInfo({conversationIDKey: ownProps.conversationIDKey})),
})

const mergeProps = (
  stateProps: ReturnType<typeof mapStateToProps>,
  dispatchProps: ReturnType<typeof mapDispatchToProps>
) => ({
  actions: (stateProps._info.actions || []).map((a: RPCChatTypes.UICommandStatusActionTyp) => {
    switch (a) {
      case RPCChatTypes.UICommandStatusActionTyp.appsettings:
        return {
          displayText: 'View App Settings',
          onClick: dispatchProps._onOpenAppSettings,
        }
      default:
        return {
          displayText: '???',
          onClick: () => {},
        }
    }
  }),
  displayText: stateProps._info.displayText,
  displayType: stateProps._info.displayType,
  onCancel: dispatchProps.onCancel,
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'CommandStatus')(CommandStatus)
