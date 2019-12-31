import * as React from 'react'
import * as Container from '../../../util/container'
import * as Types from '../../../constants/types/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Kb from '../../../common-adapters'
import * as Constants from '../../../constants/chat2'
import * as RouteTreeGen from '../../../actions/route-tree-gen'

type Props = Container.RouteProps<{botUsername: string; conversationIDKey: Types.ConversationIDKey}>

const ConfirmBotRemove = (props: Props) => {
  const botUsername = Container.getRouteProps(props, 'botUsername', '')
  const conversationIDKey = Container.getRouteProps(props, 'conversationIDKey', '')
  // dispatch
  const dispatch = Container.useDispatch()
  const onClose = () => {
    dispatch(RouteTreeGen.createClearModals())
  }
  const onRemove = () => {
    dispatch(Chat2Gen.createRemoveBotMember({conversationIDKey, username: botUsername}))
  }
  return (
    <Kb.ConfirmModal
      prompt={`Are you sure you want to uninstall ${botUsername}?`}
      waitingKey={Constants.waitingKeyBotRemove}
      onConfirm={onRemove}
      onCancel={onClose}
      description=""
      header={<Kb.Avatar username={botUsername} size={96} />}
    />
  )
}

export default ConfirmBotRemove
