import * as React from 'react'
import * as Sb from '../stories/storybook'
import {Box2} from './box'
import CopyableText from './copyable-text'

const Kb = {
  Box2,
}

const load = () => {
  Sb.storiesOf('Common', module).add('CopyableText', () => (
    <Kb.Box2 direction="vertical" centerChildren={true} gap="medium" gapStart={true}>
      <CopyableText value=" jwieojfiowenjf oiewcnuweoicfnjweiocnjewiocfjnweoicjnc v nw ivn fvjsd kh" />
    </Kb.Box2>
  ))
}

export default load
