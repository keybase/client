import * as C from '@/constants'
import * as ConvoState from '@/stores/convostate'
import * as Teams from '@/stores/teams'
import * as Kb from '@/common-adapters'
import UserNotice from '../user-notice'
import * as T from '@/constants/types'
import * as dateFns from 'date-fns'
import {useCurrentUserState} from '@/stores/current-user'

type OwnProps = {message: T.Chat.MessageSystemChangeRetention}

function SystemChangeRetentionContainer(p: OwnProps) {
  const {message} = p
  const {isInherit, isTeam, membersType, policy, user} = message
  const you = useCurrentUserState(s => s.username)
  const {teamType, teamname, showInfoPanel} = ConvoState.useChatContext(
    C.useShallow(s => ({
      showInfoPanel: s.dispatch.showInfoPanel,
      teamType: s.meta.teamType,
      teamname: s.meta.teamname,
    }))
  )
  const canManage = Teams.useTeamsState(s =>
    teamType === 'adhoc' ? true : Teams.getCanPerform(s, teamname).setRetentionPolicy
  )
  const onManageRetention = () => {
    showInfoPanel(true, 'settings')
  }

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
}

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
