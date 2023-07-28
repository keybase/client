import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as Constants from '../../../constants/chat2'
import * as ConfigConstants from '../../../constants/config'
import CommandStatus from '.'

const empty = {
  actions: [],
  displayText: '',
  displayType: RPCChatTypes.UICommandStatusDisplayTyp.error,
}

export default () => {
  const info = Constants.useContext(s => s.commandStatus)
  const _info = info || empty

  const onOpenAppSettings = ConfigConstants.useConfigState(s => s.dispatch.dynamic.openAppSettings)
  const setCommandStatusInfo = Constants.useContext(s => s.dispatch.setCommandStatusInfo)
  const onCancel = () => {
    setCommandStatusInfo()
  }
  const props = {
    actions: (_info.actions || []).map((a: RPCChatTypes.UICommandStatusActionTyp) => {
      switch (a) {
        case RPCChatTypes.UICommandStatusActionTyp.appsettings:
          return {
            displayText: 'View App Settings',
            onClick: () => onOpenAppSettings?.(),
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
