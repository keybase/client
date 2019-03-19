// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Sb from '../../../stories/storybook'
import ThreadSearch from './index'

const base = {
  onCancel: Sb.action('onCancel'),
  onDown: Sb.action('onDown'),
  onSearch: Sb.action('onSearch'),
  onUp: Sb.action('onUp'),
}

const initial = {
  ...base,
  inProgress: false,
  selectedResult: 0,
  totalResults: 0,
}

const started = {
  ...base,
  inProgress: true,
  selectedResult: 0,
  totalResults: 0,
}

const partial = {
  ...base,
  inProgress: true,
  selectedResult: 4,
  totalResults: 8,
}

const complete = {
  ...base,
  inProgress: false,
  selectedResult: 3,
  totalResults: 8,
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/ThreadSearch', module)
    .addDecorator(story => <Kb.Box style={{maxWidth: 500, padding: 5}}>{story()}</Kb.Box>)
    .add('Initial', () => <ThreadSearch {...initial} />)
    .add('Started', () => <ThreadSearch {...started} />)
    .add('Partial', () => <ThreadSearch {...partial} />)
    .add('Complete', () => <ThreadSearch {...complete} />)
}

export default load
