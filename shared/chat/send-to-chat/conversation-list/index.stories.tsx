import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import {ConversationListRender} from './conversation-list'
import {Box} from '../../../common-adapters'

const props = {
  onSelect: Sb.action('onSelect'),
  results: [
    {
      convID: new Buffer(''),
      isTeam: false,
      name: 'mikem',
      parts: ['mikem'],
      tlfName: 'mikem',
    },
    {
      convID: new Buffer(''),
      isTeam: false,
      name: 'karenm,chris',
      parts: ['karenm', 'chris'],
      tlfName: 'chris,karenm',
    },
    {
      convID: new Buffer(''),
      isTeam: true,
      name: 'keybase#core',
      tlfName: 'keybase',
    },
    {
      convID: new Buffer(''),
      isTeam: true,
      name: 'puzzles',
      tlfName: 'puzzles',
    },
  ],
  selected: 1,
  setQuery: Sb.action('setQuery'),
  setSelected: Sb.action('setSelected'),
  waiting: false,
}

export default () =>
  Sb.storiesOf('Files/SendToChat/Attachment/ConversationList', module)
    .addDecorator(story => <Box style={{height: 500, width: 320}}>{story()}</Box>)
    .add('normal', () => <ConversationListRender {...props} />)
