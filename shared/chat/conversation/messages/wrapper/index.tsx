import Text from '../text/wrapper'
import Attachment from '../attachment/wrapper'
import JourneyCard from '../cards/team-journey/wrapper'
import Placeholder from '../placeholder/wrapper'
import {WrapperGeneric, type Props} from './wrapper'
import type * as Types from '../../../../constants/types/chat2'

// TODO more items
const typeMap = {
  attachment: Attachment,
  journeycard: JourneyCard,
  placeholder: Placeholder,
  text: Text,
} satisfies Partial<Record<Types.MessageType, React.NamedExoticComponent<Props>>> as Record<
  Types.MessageType,
  React.NamedExoticComponent<Props> | undefined
>

export const getMessageRender = (type: Types.MessageType) => {
  if (type === 'deleted') return null
  const temp = typeMap[type]
  return temp ?? WrapperGeneric
}
