// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Sb from '../../../stories/storybook'
import ThreadSearch from './index'

const initialProps = {
  inProgress: false,
  onDown: Sb.action('onDown'),
  onSearch: Sb.action('onSearch'),
  onUp: Sb.action('onUp'),
  selectedResult: 0,
  totalResults: 0,
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/ThreadSearch', module)
    .addDecorator(story => <Kb.Box style={{maxWidth: 500, padding: 5}}>{story()}</Kb.Box>)
    .add('Initial', () => <ThreadSearch {...initialProps} />)
}

export default load
