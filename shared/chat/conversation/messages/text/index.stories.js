// @flow
import * as Types from '../../../../constants/types/chat2'
import I from 'immutable'
import React from 'react'
import Text from '.'
import {Box2} from '../../../../common-adapters'
import {storiesOf, createPropProvider} from '../../../../stories/storybook'

const props = {
  isEditing: false,
  mentionsAt: I.Set(),
  mentionsChannel: 'none',
  mentionsChannelName: I.Map({}),
  text: 'hello',
  type: 'sent',
}

const provider = createPropProvider({
  Channel: p => ({name: p.name}),
  Mention: p => ({username: p.username}),
})

const Wrapped = props => (
  <Box2 direction="vertical">
    <Text {...props} />
  </Box2>
)

const load = () => {
  storiesOf('Chat/Conversation/Rows', module)
    .addDecorator(provider)
    .add('Text', () => (
      <React.Fragment>
        <Wrapped {...props} />
        <Wrapped {...props} text="world" />
        <Wrapped {...props} text="editing" isEditing={true} />
        <Wrapped {...props} text="contains a @mention thing" mentionsAt={I.Set(['mention'])} />
        <Wrapped
          {...props}
          text="contains a #random thing"
          mentionsChannelName={I.Map({random: Types.stringToConversationIDKey('123')})}
        />
      </React.Fragment>
    ))
}

export default load
