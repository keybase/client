// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Kb from '../../common-adapters'

const load = () => {
  Sb.storiesOf('Profile/Generic Proofs', module).add('Success', () => <Kb.Text type="Body">TODO</Kb.Text>)
}

export default load
