import Text from '../text/wrapper'
import Attachment from '../attachment/wrapper'
import JourneyCard from '../cards/team-journey/wrapper'
import {WrapperGeneric, type Props} from './wrapper'
import type * as Types from '../../../../constants/types/chat2'

// TODO more items
const typeMap = {
  attachment: Attachment,
  journeycard: JourneyCard,
  text: Text,
} satisfies Partial<Record<Types.MessageType, React.NamedExoticComponent<Props>>> as Record<
  Types.MessageType,
  React.NamedExoticComponent<Props> | undefined
>

export const getMessageRender = (type: Types.MessageType) => {
  const temp = typeMap[type]
  return temp ?? WrapperGeneric
}
