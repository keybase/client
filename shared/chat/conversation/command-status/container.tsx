import type * as Types from '../../../constants/types/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as ConfigGen from '../../../actions/config-gen'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as Container from '../../../util/container'
import CommandStatus from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

const empty = {
  actions: [],
  displayText: '',
  displayType: RPCChatTypes.UICommandStatusDisplayTyp.error,
}

export default (ownProps: OwnProps) => {
  const info = Container.useSelector(state => state.chat2.commandStatusMap.get(ownProps.conversationIDKey))
  const _info = info || empty
  const dispatch = Container.useDispatch()
  const _onOpenAppSettings = () => {
    dispatch(ConfigGen.createOpenAppSettings())
  }
  const onCancel = () => {
    dispatch(Chat2Gen.createClearCommandStatusInfo({conversationIDKey: ownProps.conversationIDKey}))
  }
  const props = {
    actions: (_info.actions || []).map((a: RPCChatTypes.UICommandStatusActionTyp) => {
      switch (a) {
        case RPCChatTypes.UICommandStatusActionTyp.appsettings:
          return {
            displayText: 'View App Settings',
            onClick: _onOpenAppSettings,
          }
        default:
          return {
            displayText: '???',
            onClick: () => {},
          }
      }
    }),
    displayText: _info.displayText,
    displayType: _info.displayType,
    onCancel,
  }
  return <CommandStatus {...props} />
}
