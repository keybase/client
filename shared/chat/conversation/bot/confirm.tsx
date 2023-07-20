import * as Container from '../../../util/container'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Kb from '../../../common-adapters'
import * as Constants from '../../../constants/chat2'
import * as RouterConstants from '../../../constants/router2'
import type * as Types from '../../../constants/types/chat2'
import type * as TeamsTypes from '../../../constants/types/teams'
import {useBotConversationIDKey} from './install'

type LoaderProps = {
  botUsername: string
  conversationIDKey?: Types.ConversationIDKey
  teamID?: TeamsTypes.TeamID
}

const ConfirmBotRemoveLoader = (props: LoaderProps) => {
  const botUsername = props.botUsername
  const inConvIDKey = props.conversationIDKey
  const teamID = props.teamID
  const conversationIDKey = useBotConversationIDKey(inConvIDKey, teamID)
  return <ConfirmBotRemove botUsername={botUsername} conversationIDKey={conversationIDKey} />
}

type Props = {
  botUsername: string
  conversationIDKey?: Types.ConversationIDKey
}

const ConfirmBotRemove = (props: Props) => {
  const {botUsername, conversationIDKey} = props
  // dispatch
  const dispatch = Container.useDispatch()
  const clearModals = RouterConstants.useState(s => s.dispatch.clearModals)
  const onClose = () => {
    clearModals()
  }
  const onRemove = conversationIDKey
    ? () => {
        dispatch(Chat2Gen.createRemoveBotMember({conversationIDKey, username: botUsername}))
      }
    : undefined
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

export default ConfirmBotRemoveLoader
