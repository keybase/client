import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import UserNotice from '../user-notice'
import SystemMessageTimestamp from '../system-message-timestamp'

type Props = {
  message: Types.MessageSystemSBSResolbed
  you: string
}

const connectedUsernamesProps = {
  colorFollowing: true,
  inline: true,
  onUsernameClicked: 'profile',
  type: 'BodySmallSemibold',
  underline: true,
} as const

const formatAssertion = (assertion: string): string => {
  // TODO format this nicely e.g. "malgorithms on Twitter" or "+1 (216) 223-8548"
  return assertion
}

const SBSProvedNotice = (props: Props) => {
  if (props.you === props.message.prover) {
    return <YouSBSProvedNotice {...props} />
  }
  const {prover, assertion} = props.message
  // There's not a lot of space to explain the adder / inviter situation,
  // just pretend they were added by the inviter for now.
  return (
    <Kb.Text type="BodySmall">
      <Kb.ConnectedUsernames {...connectedUsernamesProps} usernames={[prover]} /> proved that they are{' '}
      {formatAssertion(assertion)} and this chat resolved.
    </Kb.Text>
  )
}

const YouSBSProvedNotice = (props: Props) => {
  const {timestamp, assertion} = props.message

  const copy = (
    <Kb.Text center={true} type="BodySmallSemibold">
      You proved that you are {formatAssertion(assertion)}, so now you can see this chat.
    </Kb.Text>
  )

  return (
    <UserNotice style={{marginTop: Styles.globalMargins.small}} bgColor={Styles.globalColors.blueLighter2}>
      <SystemMessageTimestamp timestamp={timestamp} />
      <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, alignItems: 'center'}}>{copy}</Kb.Box>
    </UserNotice>
  )
}

export default SBSProvedNotice
