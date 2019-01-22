// @flow
import * as React from 'react'
import * as Sb from '../stories/storybook'
import * as Kb from '.'

const load = () => {
  Sb.storiesOf('Common/Dice', module)
    .add('Random', () => <Kb.Dice onRollDone={Sb.action('onRollDone')} />)
    .add('Set [4, 2]', () => <Kb.Dice onRollDone={Sb.action('onRollDone')} values={[4, 2]} />)
}

export default load
