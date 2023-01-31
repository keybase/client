import * as React from 'react'
import {ConvoIDContext} from '../../ids-context'
import type TeamJourneyType from './container'
import type * as Types from '../../../../../constants/types/chat2'

type Props = {
  ordinal: Types.Ordinal
}
const WrapperJourneyCard = React.memo(function WrapperJourneyCard(p: Props) {
  const {ordinal} = p
  const conversationIDKey = React.useContext(ConvoIDContext)

  const TeamJourney = require('./container').default as typeof TeamJourneyType
  return <TeamJourney key="journey" conversationIDKey={conversationIDKey} ordinal={ordinal} />
})

export default WrapperJourneyCard
