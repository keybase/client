import * as React from 'react'
import * as I from 'immutable'
import * as Sb from '../../../../../stories/storybook'
import {Typing} from '.'

const props = {
  names: I.Set(),
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/Typing', module)
    .add('None', () => <Typing {...props} />)
    .add('One', () => <Typing {...props} names={I.Set(['alice'])} />)
    .add('Two', () => <Typing {...props} names={I.Set(['alice', 'bob'])} />)
    .add('Three', () => <Typing {...props} names={I.Set(['alice', 'bob', 'jane'])} />)
    .add('Four', () => <Typing {...props} names={I.Set(['alice', 'bob', 'jane', 'joe'])} />)
}

export default load
