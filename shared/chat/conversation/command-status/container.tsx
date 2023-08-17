import * as C from '../../../constants'
import * as T from '../../../constants/types'
import CommandStatus from '.'

const empty = {
  actions: [],
  displayText: '',
  displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
}

export default () => {
  const info = C.useChatContext(s => s.commandStatus)
  const _info = info || empty

  const onOpenAppSettings = C.useConfigState(s => s.dispatch.dynamic.openAppSettings)
  const setCommandStatusInfo = C.useChatContext(s => s.dispatch.setCommandStatusInfo)
  const onCancel = () => {
    setCommandStatusInfo()
  }
  const props = {
    actions: (_info.actions || []).map((a: T.RPCChat.UICommandStatusActionTyp) => {
      switch (a) {
        case T.RPCChat.UICommandStatusActionTyp.appsettings:
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
