import type TeamJourneyType from '@/chat/conversation/messages/cards/team-journey/container'
import type * as T from '@/constants/types'

type Props = {ordinal: T.Chat.Ordinal}

function WrapperJourneyCard(p: Props) {
  const {ordinal} = p
  const {default: TeamJourney} = require('./container') as {default: typeof TeamJourneyType}
  return <TeamJourney key="journey" ordinal={ordinal} />
}

export default WrapperJourneyCard
