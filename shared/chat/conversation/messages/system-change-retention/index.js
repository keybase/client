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
  onClickUserAvatar: () => void,
  onManageRetention: () => void,
  policy: RPCChatTypes.RetentionPolicy,
  user: string,
  you: string,
  timestamp: number,
|}

const getPolicySummary = props => {
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
  const changedBy =
    props.you === props.user ? (
      'You'
    ) : (
      <Kb.ConnectedUsernames
        colorFollowing={true}
        inline={true}
        onUsernameClicked={'profile'}
        type={'BodySmallSemibold'}
        underline={true}
        usernames={[props.user]}
      />
    )
  let convType = 'conversation'
  switch (props.membersType) {
    case RPCChatTypes.commonConversationMembersType.team:
      convType = props.isTeam ? 'team' : 'channel'
  }
  const inheritDescription = props.isInherit ? ' to inherit from the team policy' : ''
  const policySummary = getPolicySummary(props)
  const manageText = props.canManage ? 'Manage this' : ''
  return (
    <UserNotice
      style={styles.userNotice}
      username={props.user}
      bgColor={Styles.globalColors.blue4}
      onClickAvatar={() => props.onClickUserAvatar()}
    >
      <Kb.Text type="BodySmallSemibold" backgroundMode="Announcements" style={styles.text}>
        {formatTimeForMessages(props.timestamp)}
      </Kb.Text>
      <Kb.Box2 direction="vertical" centerChildren={true}>
        <Kb.Text type="BodySmallSemibold" center={true} backgroundMode="Announcements" style={styles.text}>
          {changedBy} changed the {convType} retention policy{inheritDescription}. Messages will{' '}
          {policySummary}.
        </Kb.Text>
        <Kb.Text onClick={props.onManageRetention} type="BodySmallSemiboldPrimaryLink">
          {manageText}
        </Kb.Text>
      </Kb.Box2>
    </UserNotice>
  )
}

const styles = Styles.styleSheetCreate({
  text: {color: Styles.globalColors.black_50},
  userNotice: {marginTop: Styles.globalMargins.small},
})

export default ChangeRetention
