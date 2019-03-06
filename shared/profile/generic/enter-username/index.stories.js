// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import EnterUsername from '.'

const load = () => {
  Sb.storiesOf('Profile/Generic Proofs/Enter username', module).add('Empty', () => <EnterUsername />)
}

export default load
