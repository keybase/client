// @flow
import {} from '../../../../stories/storybook'
import * as Types from '../../../../constants/types/chat2'
import type {OwnProps} from './container'
import type {Props as ViewProps} from '.'

const messageIDToEmojis = {
  '95': [':bee:', ':eyes:', ':musical_keyboard:', ':battery:'],
  '97': [':globe_with_meridians:', ':face_with_cowboy_hat:'],
  '99': [':+1:', ':-1:'],
}

export const propProvider = {
  ReactionsRow: (props: OwnProps): ViewProps => ({
    emojis: messageIDToEmojis[Types.messageIDToNumber(props.messageID)] || [],
    messageID: props.messageID,
  }),
}
