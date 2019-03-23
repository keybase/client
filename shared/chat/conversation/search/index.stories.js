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

const hits = [
  {
    author: 'mikem',
    summary: 'keybase is the best',
    timestamp: 1542241021655,
  },
  {
    author: 'karenm',
    summary: 'keybase is the best sometimes when it works',
    timestamp: 1542241021655,
  },
  {
    author: 'patrick',
    summary: 'keybase now supports stellar wallet for making psyments to friends and other internet people',
    timestamp: 1542241021655,
  },
]

const initial = {
  ...base,
  hits: [],
  inProgress: false,
}

const started = {
  ...base,
  hits: [],
  inProgress: true,
}

const partial = {
  ...base,
  hits,
  inProgress: true,
}

const complete = {
  ...base,
  hits,
  inProgress: false,
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
