import type * as Types from '../../../../constants/types/chat2'
import type {ServiceIdWithContact} from '../../../../constants/types/team-building'
import * as Kb from '../../../../common-adapters'
import {e164ToDisplay} from '../../../../util/phone-numbers'
import {serviceIdToPrettyName} from '../../../../constants/team-building'
import UserNotice from '../user-notice'

type Props = {
  message: Types.MessageSystemSBSResolved
  you: string
}

const formatAssertion = (serviceUser: string, service: ServiceIdWithContact, isYou: boolean): string => {
  switch (service) {
    case 'phone':
      return `verified ${isYou ? 'your' : 'their'} phone number ${e164ToDisplay('+' + serviceUser)}`
    case 'email':
      return `verified ${isYou ? 'your' : 'their'} email address ${serviceUser}`
    default:
      return `proved ${isYou ? 'you' : 'they'} are ${serviceUser} on ${
        serviceIdToPrettyName(service) || service
      }`
  }
}

const SBSProvedNotice = (props: Props) => {
  const {prover, assertionUsername, assertionService} = props.message
  const isYou = props.you === prover
  return (
    <UserNotice>
      <Kb.Text type="BodySmall">
        {isYou && 'You '}can read this chat now because {isYou ? 'you' : 'they'}{' '}
        {assertionService && formatAssertion(assertionUsername, assertionService, isYou)}.
      </Kb.Text>
    </UserNotice>
  )
}

export default SBSProvedNotice
