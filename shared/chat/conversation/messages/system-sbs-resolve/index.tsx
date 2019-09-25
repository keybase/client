import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as Kb from '../../../../common-adapters'
import {formatTimeForChat} from '../../../../util/timestamp'

type Props = {
  message: Types.MessageSystemSBSResolved
  you: string
}

const connectedUsernamesProps = {
  colorFollowing: true,
  inline: true,
  onUsernameClicked: 'profile',
  type: 'BodySmallSemibold',
  underline: true,
} as const

const formatAssertion = (serviceUser: string, service: string, isYou: boolean): string => {
  if (isYou) {
    return formatAssertionYou(serviceUser, service)
  }
  switch (service) {
    case 'phone':
      return `verified their phone number ${serviceUser}`
    case 'email':
      return `verified their email address ${serviceUser}`
    default:
      return `proved that they are ${serviceUser} on ${service}`
  }
}
const formatAssertionYou = (serviceUser: string, service: string): string => {
  switch (service) {
    case 'phone':
      return `your phone number ${serviceUser}`
    case 'email':
      return `your email address ${serviceUser}`
    default:
      return `that you are ${serviceUser} on ${service}`
  }
}

const SBSProvedNotice = (props: Props) => {
  const {timestamp, prover, assertionUsername, assertionService} = props.message
  const isYou = props.you === props.message.prover
  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Text type="BodyTiny">{formatTimeForChat(timestamp)}</Kb.Text>
      <Kb.Text type="BodySmall">
        {isYou ? 'You' : <Kb.ConnectedUsernames {...connectedUsernamesProps} usernames={[prover]} />}{' '}
        {formatAssertion(assertionUsername, assertionService, isYou)}, so now {isYou ? 'you' : 'they'} can see
        this chat.
      </Kb.Text>
    </Kb.Box2>
  )
}

export default SBSProvedNotice
