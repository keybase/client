import * as Chat from '@/stores/chat2'
import * as React from 'react'
import * as Teams from '@/stores/teams'
import * as Kb from '@/common-adapters'
import UserNotice from '../user-notice'
import * as T from '@/constants/types'
import * as dateFns from 'date-fns'
import {useCurrentUserState} from '@/stores/current-user'

type OwnProps = {message: T.Chat.MessageSystemChangeRetention}

const SystemChangeRetentionContainer = React.memo(function SystemChangeRetentionContainer(p: OwnProps) {
  const {message} = p
  const {isInherit, isTeam, membersType, policy, user} = message
  const you = useCurrentUserState(s => s.username)
  const meta = Chat.useChatContext(s => s.meta)
  const canManage = Teams.useTeamsState(s =>
    meta.teamType === 'adhoc' ? true : Teams.getCanPerform(s, meta.teamname).setRetentionPolicy
  )
  const showInfoPanel = Chat.useChatContext(s => s.dispatch.showInfoPanel)
  const onManageRetention = React.useCallback(() => {
    showInfoPanel(true, 'settings')
  }, [showInfoPanel])

  const changedBy = you === user ? 'You ' : ''
  let convType = 'conversation'
  switch (membersType) {
    case T.RPCChat.ConversationMembersType.team:
      convType = isTeam ? 'team' : 'channel'
      break
    default:
  }
  const inheritDescription = isInherit ? ' to inherit from the team policy' : ''
  const policySummary = getPolicySummary(policy)
  const manageText = canManage ? 'Retention settings' : ''
  return (
    <UserNotice>
      <Kb.Text type="BodySmall" selectable={true}>
        {changedBy}changed the {convType} retention policy{inheritDescription}. Messages will {policySummary}.
        {` `}
      </Kb.Text>
      {manageText ? (
        <Kb.Text onClick={onManageRetention} type="BodySmallSemiboldPrimaryLink">
          {manageText}
        </Kb.Text>
      ) : null}
    </UserNotice>
  )
})

const getPolicySummary = (policy: T.RPCChat.RetentionPolicy | undefined) => {
  if (!policy) {
    return 'be retained indefinitely'
  }
  switch (policy.typ) {
    case T.RPCChat.RetentionPolicyType.none:
    case T.RPCChat.RetentionPolicyType.retain:
      return 'be retained indefinitely'
    case T.RPCChat.RetentionPolicyType.expire:
      {
        const expireDuration = dateFns.formatDistanceStrict(0, policy.expire.age * 1000)
        if (expireDuration !== '') {
          return `expire after ${expireDuration}`
        }
      }
      break
    case T.RPCChat.RetentionPolicyType.ephemeral:
      {
        const ephemeralDuration =
          // date-fns writes 30 seconds as 1 minute
          policy.ephemeral.age === 30
            ? '30 seconds'
            : dateFns.formatDistanceStrict(0, policy.ephemeral.age * 1000)
        if (ephemeralDuration !== '') {
          return `explode after ${ephemeralDuration} by default`
        }
      }
      break
    default:
  }
  return ''
}

export default SystemChangeRetentionContainer
