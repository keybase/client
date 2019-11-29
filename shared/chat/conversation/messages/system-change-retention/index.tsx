import moment from 'moment'
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import UserNotice from '../user-notice'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'

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

const getPolicySummary = props => {
  if (!props.policy) {
    return 'be retained indefinitely'
  }
  switch (props.policy.typ) {
    case RPCChatTypes.RetentionPolicyType.none:
    case RPCChatTypes.RetentionPolicyType.retain:
      return 'be retained indefinitely'
    case RPCChatTypes.RetentionPolicyType.expire:
      {
        const expireDuration = moment
          .duration(
            // Auto generated from flowToTs. Please clean me!
            props.policy.expire === null || props.policy.expire === undefined
              ? undefined
              : props.policy.expire.age,
            'seconds'
          )
          .humanize()
        if (expireDuration !== '') {
          return `expire after ${expireDuration}`
        }
      }
      break
    case RPCChatTypes.RetentionPolicyType.ephemeral:
      {
        const ephemeralDuration = moment
          .duration(
            // Auto generated from flowToTs. Please clean me!
            props.policy.ephemeral === null || props.policy.ephemeral === undefined
              ? undefined
              : props.policy.ephemeral.age,
            'seconds'
          )
          .humanize()
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
  const manageText = props.canManage ? 'Team retention settings' : ''
  return (
    <UserNotice>
      <Kb.Text type="BodySmall" selectable={true}>
        {changedBy}changed the {convType} retention policy{inheritDescription}. Messages will {policySummary}.
        {` `}
        {manageText ? (
          <Kb.Text onClick={props.onManageRetention} type="BodySmallSemiboldPrimaryLink">
            {manageText}
          </Kb.Text>
        ) : null}
      </Kb.Text>
    </UserNotice>
  )
}

export default ChangeRetention
