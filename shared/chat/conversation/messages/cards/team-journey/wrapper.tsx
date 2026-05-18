import TeamJourney from './container'
import type * as T from '@/constants/types'

type Props = {ordinal: T.Chat.Ordinal}

function WrapperJourneyCard(p: Props) {
  const {ordinal} = p
  return <TeamJourney key="journey" ordinal={ordinal} />
}

export default WrapperJourneyCard
