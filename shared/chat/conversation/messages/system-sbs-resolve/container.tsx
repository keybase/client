import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {e164ToDisplay} from '@/util/phone-numbers'
import UserNotice from '../user-notice'
import {useCurrentUserState} from '@/stores/current-user'

type OwnProps = {message: T.Chat.MessageSystemSBSResolved}

const Container = (ownProps: OwnProps) => {
  const {message} = ownProps
  const you = useCurrentUserState(s => s.username)
  const {prover, assertionUsername, assertionService} = message
  const isYou = you === prover
  return (
    <UserNotice>
      <Kb.Text type="BodySmall">
        {isYou && 'You '}can read this chat now because {isYou ? 'you' : 'they'}{' '}
        {assertionService && formatAssertion(assertionUsername, assertionService, isYou)}.
      </Kb.Text>
    </UserNotice>
  )
}

function serviceIdToPrettyName(serviceId: T.TB.ServiceId): string {
  return {
    facebook: 'Facebook',
    github: 'GitHub',
    hackernews: 'Hacker News',
    keybase: 'Keybase',
    reddit: 'Reddit',
    twitter: 'Twitter',
  }[serviceId]
}

const formatAssertion = (serviceUser: string, service: T.TB.ServiceIdWithContact, isYou: boolean): string => {
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

export default Container
