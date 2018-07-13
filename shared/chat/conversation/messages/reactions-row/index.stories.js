// @flow
import {} from '../../../../stories/storybook'
import * as MessageTypes from '../../../../constants/types/chat2/message'
import type {OwnProps} from './container'
import type {Props as ViewProps} from '.'

const messageIDToEmojis = {
  '0': [':+1:', ':-1:'],
}

export const propProvider = {
  ReactionsRow: (props: OwnProps): ViewProps => ({
    emojis: messageIDToEmojis[MessageTypes.messageIDToNumber(props.messageID)],
    messageID: props.messageID,
  }),
}
