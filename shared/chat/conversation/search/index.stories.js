// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Sb from '../../../stories/storybook'
import {ThreadSearchDesktop as ThreadSearch} from './index'

const base = {
  loadSearchHit: Sb.action('loadSearchHit'),
  onCancel: Sb.action('onCancel'),
  onSearch: Sb.action('onSearch'),
  selfHide: Sb.action('selfHide'),
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
    summary:
      'keybase now supports stellar wallet for making psyments to friends and other internet people. MOre long text to see what we do in a case with a really long message hihihihi',
    timestamp: 1542241021655,
  },
]

const initial = {
  ...base,
  hits: [],
  status: 'initial',
}

const started = {
  ...base,
  hits: [],
  status: 'inprogress',
}

const partial = {
  ...base,
  hits,
  status: 'inprogress',
}

const complete = {
  ...base,
  hits,
  status: 'done',
}

const none = {
  ...base,
  hits: [],
  status: 'done',
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/ThreadSearch', module)
    .addDecorator(story => <Kb.Box style={{maxWidth: 800, padding: 5}}>{story()}</Kb.Box>)
    .add('Initial', () => <ThreadSearch {...initial} />)
    .add('Started', () => <ThreadSearch {...started} />)
    .add('Partial', () => <ThreadSearch {...partial} />)
    .add('Complete', () => <ThreadSearch {...complete} />)
    .add('No Results', () => <ThreadSearch {...none} />)
}

export default load
