import * as React from 'react'
import * as Sb from '../../../../../stories/storybook'
import {Typing} from '.'

const load = () => {
  Sb.storiesOf('Chat/Conversation/Typing', module)
    .add('None', () => <Typing names={new Set()} />)
    .add('One', () => <Typing names={new Set(['alice'])} />)
    .add('Two', () => <Typing names={new Set(['alice', 'bob'])} />)
    .add('Three', () => <Typing names={new Set(['alice', 'bob', 'jane'])} />)
    .add('Four', () => <Typing names={new Set(['alice', 'bob', 'jane', 'joe'])} />)
}

export default load
