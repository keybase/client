import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {ServiceIdWithContact} from '../../../../constants/types/team-building'
import * as Kb from '../../../../common-adapters'
import {e164ToDisplay} from '../../../../util/phone-numbers'
import {serviceIdToPrettyName} from '../../../../constants/team-building'
import UserNotice from '../user-notice'

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

const formatAssertion = (serviceUser: string, service: ServiceIdWithContact, isYou: boolean): string => {
  if (isYou) {
    return formatAssertionYou(serviceUser, service)
  }
  switch (service) {
    case 'phone':
      return `verified their phone number ${e164ToDisplay('+' + serviceUser)}`
    case 'email':
      return `verified their email address ${serviceUser}`
    default:
      return `proved they are ${serviceUser} on ${serviceIdToPrettyName(service) || service}`
  }
}

const formatAssertionYou = (serviceUser: string, service: ServiceIdWithContact): string => {
  switch (service) {
    case 'phone':
      return `verified your phone number ${e164ToDisplay('+' + serviceUser)}`
    case 'email':
      return `verified your email address ${serviceUser}`
    default:
      return `proved you are ${serviceUser} on ${serviceIdToPrettyName(service) || service}`
  }
}

const SBSProvedNotice = (props: Props) => {
  const {prover, assertionUsername, assertionService} = props.message
  const isYou = props.you === prover
  return (
    <UserNotice>
      <Kb.Text type="BodySmall">
        {isYou ? 'You' : <Kb.ConnectedUsernames {...connectedUsernamesProps} usernames={[prover]} />} can read
        this chat now because {isYou ? 'you' : 'they'}{' '}
        {assertionService && formatAssertion(assertionUsername, assertionService, isYou)}.
      </Kb.Text>
    </UserNotice>
  )
}

export default SBSProvedNotice
