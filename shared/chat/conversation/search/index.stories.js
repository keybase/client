// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Sb from '../../../stories/storybook'
import ThreadSearch from './index'

const base = {
  loadSearchHit: Sb.action('loadSearchHit'),
  onCancel: Sb.action('onCancel'),
  onSearch: Sb.action('onSearch'),
}

const initial = {
  ...base,
  inProgress: false,
  totalResults: 0,
}

const started = {
  ...base,
  inProgress: true,
  totalResults: 0,
}

const partial = {
  ...base,
  inProgress: true,
  totalResults: 8,
}

const complete = {
  ...base,
  inProgress: false,
  totalResults: 8,
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/ThreadSearch', module)
    .addDecorator(story => <Kb.Box style={{maxWidth: 800, padding: 5}}>{story()}</Kb.Box>)
    .add('Initial', () => <ThreadSearch {...initial} />)
    .add('Started', () => <ThreadSearch {...started} />)
    .add('Partial', () => <ThreadSearch {...partial} />)
    .add('Complete', () => <ThreadSearch {...complete} />)
}

export default load
