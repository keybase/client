import React from 'react'
import * as Sb from '../../../../stories/storybook'
import SystemText from '.'
import * as Constants from '../../../../constants/chat2/message'
import HiddenString from '../../../../util/hidden-string'

const message = Constants.makeMessageSystemText({
  author: 'chris',
  reactions: new Map(),
  text: new HiddenString('a short message about something'),
  timestamp: new Date('1/1/1999').getTime(),
})

const longMessage = {
  ...message,
  text: new HiddenString(new Array(__STORYSHOT__ ? 1 : 100).fill('a word').join(' ')),
}

const longWordMessage = {
  ...message,
  text: new HiddenString(new Array(__STORYSHOT__ ? 1 : 100).fill('tooLong').join('')),
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/Rows/SystemText', module)
    .add('Normal', () => <SystemText message={message} />)
    .add('Long', () => <SystemText message={longMessage} />)
    .add('LongSingleWord', () => <SystemText message={longWordMessage} />)
}

export default load
