import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import * as MessageTypes from '../../../../../constants/types/chat2/message'
import * as RPCChatTypes from '../../../../../constants/types/rpc-chat-gen'
import * as I from 'immutable'
import TeamJourney from './index'

type Props = {
  message: I.RecordOf<MessageTypes._MessageJourneycard>
}

const TeamJourneyContainer = (props: Props) => {
  const teamname = Container.useSelector(
    state => Constants.getMeta(state, props.message.conversationIDKey).teamname
  )
  let teamJourneyText = ''
  let teamJourneyImage = null
  let teamJourneyActions = []

  switch (props.message.cardType) {
    case RPCChatTypes.JourneycardType.welcome:
      teamJourneyText = 'Welcome to the team! Say hi to everyone and introduce yourself.'
      break
    case RPCChatTypes.JourneycardType.popularChannels:
      teamJourneyText = 'You are in #somechan. Other popular channels in this team:'
      break
    case RPCChatTypes.JourneycardType.addPeople:
      teamJourneyText = `Do you know people interested in joining? ${teamname} is open to anyone.`
      break
    case RPCChatTypes.JourneycardType.createChannels:
      teamJourneyText = 'Go ahead and create #channels around topics you think are missing.'
      break
    case RPCChatTypes.JourneycardType.msgAttention:
      teamJourneyText = 'One of your messages is getting a lot of attention!'
      break
    case RPCChatTypes.JourneycardType.userAwayForLong:
      teamJourneyText = 'Long time no see! Look at all the things you missed.'
      break
    case RPCChatTypes.JourneycardType.channelInactive:
      teamJourneyText = 'Zzz… This channel hasn’t been very active…. Revive it?'
      break
    case RPCChatTypes.JourneycardType.msgNoAnswer:
      teamJourneyText = 'People haven’t been talkative in a while. Perhaps post in another channel?'
      break
    default:
      console.warn(`Unexpected journey card type: ${props.message.cardType}`)
      return <Kb.Box2 direction="horizontal" />
  }

  return teamname ? <TeamJourney teamname={teamname} text={teamJourneyText} /> : <Kb.Box2 direction="horizontal" />
}

export default TeamJourneyContainer
