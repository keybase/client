// @flow
import * as React from 'react'
import {Text} from '../../common-adapters'
import {storiesOf} from '../../stories/storybook'

const load = () => {
  storiesOf('Login/Signup', module).add('TODO', () => <Text type='Body'>TODO</Text>)
}

export default load
