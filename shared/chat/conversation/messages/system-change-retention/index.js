// @flow
import moment from 'moment'
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import UserNotice from '../user-notice'
import {formatTimeForMessages} from '../../../../util/timestamp'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'

type Props = {|
  canManage: boolean,
  isTeam: boolean,
  isInherit: boolean,
  membersType: RPCChatTypes.ConversationMembersType,
  onClickUserAvatar: (username: string) => void,
  onManageRetention: () => void,
  policy: RPCChatTypes.RetentionPolicy,
  user: string,
  you: string,
  timestamp: number,
|}

const ManageComponent = (props: {canManage: boolean, onManageRetention: () => void}) => {
  const textType = 'BodySmallSemiboldPrimaryLink'
  if (props.canManage) {
    return (
      <Kb.Text onClick={props.onManageRetention} type={textType}>
        Manage this
      </Kb.Text>
    )
  }
  return ''
}

const connectedUsernamesProps = {
  colorFollowing: true,
  inline: true,
  onUsernameClicked: 'profile',
  type: 'BodySmallSemibold',
  underline: true,
}

const YouOrUsername = (props: {username: string, you: string}) => {
  if (props.username === props.you) {
    return 'You'
  }
  return <Kb.ConnectedUsernames {...connectedUsernamesProps} usernames={[props.username]} />
}

const AppliesTo = (props: {membersType: RPCChatTypes.ConversationMembersType, isTeam: boolean}) => {
  switch (props.membersType) {
    case RPCChatTypes.commonConversationMembersType.team:
      if (props.isTeam) {
        return 'team'
      } else {
        return 'channel'
      }
  }
  return 'conversation'
}

const InheritDescription = (props: {isInherit: boolean}) => {
  if (props.isInherit) {
    return ' to inherit from the team policy'
  }
  return ''
}

const PolicySummary = (props: {policy: RPCChatTypes.RetentionPolicy, isTeam: boolean}) => {
  switch (props.policy.typ) {
    case RPCChatTypes.commonRetentionPolicyType.none:
    case RPCChatTypes.commonRetentionPolicyType.retain:
      return 'be retained indefinitely'
    case RPCChatTypes.commonRetentionPolicyType.expire:
      const expireDuration = moment.duration(props.policy.expire?.age, 'seconds').humanize()
      if (expireDuration !== '') {
        return `expire after ${expireDuration}`
      }
      break
    case RPCChatTypes.commonRetentionPolicyType.ephemeral:
      const ephemeralDuration = moment.duration(props.policy.ephemeral?.age, 'seconds').humanize()
      if (ephemeralDuration !== '') {
        return `explode after ${ephemeralDuration} by default`
      }
      break
  }
  return ''
}

const ChangeRetention = (props: Props) => {
  return (
    <UserNotice
      style={{marginTop: Styles.globalMargins.small}}
      username={props.user}
      bgColor={Styles.globalColors.blue4}
      onClickAvatar={() => props.onClickUserAvatar(props.user)}
    >
      <Kb.Text
        type="BodySmallSemibold"
        backgroundMode="Announcements"
        style={{color: Styles.globalColors.black_50}}
      >
        {formatTimeForMessages(props.timestamp)}
      </Kb.Text>
      <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, alignItems: 'center'}}>
        <Kb.Text
          type="BodySmallSemibold"
          center={true}
          backgroundMode="Announcements"
          style={{color: Styles.globalColors.black_50}}
        >
          <YouOrUsername username={props.user} you={props.you} /> changed the{' '}
          <AppliesTo membersType={props.membersType} isTeam={props.isTeam} /> retention policy
          <InheritDescription isInherit={props.isInherit} />. Messages will{' '}
          <PolicySummary policy={props.policy} isTeam={props.isTeam} />.
        </Kb.Text>
        <ManageComponent canManage={props.canManage} onManageRetention={props.onManageRetention} />
      </Kb.Box>
    </UserNotice>
  )
}

export default ChangeRetention
