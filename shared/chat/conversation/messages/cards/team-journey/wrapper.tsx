import * as React from 'react'
import type TeamJourneyType from './container'
import type * as Types from '../../../../../constants/types/chat2'

type Props = {
  ordinal: Types.Ordinal
}
const WrapperJourneyCard = React.memo(function WrapperJourneyCard(p: Props) {
  const {ordinal} = p
  const TeamJourney = require('./container').default as typeof TeamJourneyType
  return <TeamJourney key="journey" ordinal={ordinal} />
})

export default WrapperJourneyCard
