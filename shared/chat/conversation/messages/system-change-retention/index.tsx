import * as Kb from '../../../../common-adapters'
import UserNotice from '../user-notice'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as dateFns from 'date-fns'

type Props = {
  canManage: boolean
  isTeam: boolean
  isInherit: boolean
  membersType: RPCChatTypes.ConversationMembersType
  onClickUserAvatar: () => void
  onManageRetention: () => void
  policy: RPCChatTypes.RetentionPolicy | null
  user: string
  you: string
  timestamp: number
}

const getPolicySummary = (props: Props) => {
  if (!props.policy) {
    return 'be retained indefinitely'
  }
  switch (props.policy.typ) {
    case RPCChatTypes.RetentionPolicyType.none:
    case RPCChatTypes.RetentionPolicyType.retain:
      return 'be retained indefinitely'
    case RPCChatTypes.RetentionPolicyType.expire:
      {
        const expireDuration = dateFns.formatDistanceStrict(0, props.policy.expire?.age * 1000)
        if (expireDuration !== '') {
          return `expire after ${expireDuration}`
        }
      }
      break
    case RPCChatTypes.RetentionPolicyType.ephemeral:
      {
        const ephemeralDuration =
          // date-fns writes 30 seconds as 1 minute
          props.policy.ephemeral?.age === 30
            ? '30 seconds'
            : dateFns.formatDistanceStrict(0, props.policy.ephemeral?.age * 1000)
        if (ephemeralDuration !== '') {
          return `explode after ${ephemeralDuration} by default`
        }
      }
      break
  }
  return ''
}

const ChangeRetention = (props: Props) => {
  const changedBy = props.you === props.user ? 'You ' : ''
  let convType = 'conversation'
  switch (props.membersType) {
    case RPCChatTypes.ConversationMembersType.team:
      convType = props.isTeam ? 'team' : 'channel'
  }
  const inheritDescription = props.isInherit ? ' to inherit from the team policy' : ''
  const policySummary = getPolicySummary(props)
  const manageText = props.canManage ? 'Retention settings' : ''
  return (
    <UserNotice>
      <Kb.Text type="BodySmall" selectable={true}>
        {changedBy}changed the {convType} retention policy{inheritDescription}. Messages will {policySummary}.
        {` `}
      </Kb.Text>
      {manageText ? (
        <Kb.Text onClick={props.onManageRetention} type="BodySmallSemiboldPrimaryLink">
          {manageText}
        </Kb.Text>
      ) : null}
    </UserNotice>
  )
}

export default ChangeRetention
