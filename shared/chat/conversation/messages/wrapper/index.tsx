import WrapperText from '../text/wrapper'
import WrapperJourneyCard from '../cards/team-journey/wrapper'
import {WrapperGeneric} from './wrapper'
import type * as Types from '../../../../constants/types/chat2'

export const getMessageRender = (type: Types.MessageType) => {
  switch (type) {
    case 'text':
      return WrapperText
    case 'journeycard':
      return WrapperJourneyCard
    // TODO move more things here eventually
    default:
      return WrapperGeneric
  }
}
