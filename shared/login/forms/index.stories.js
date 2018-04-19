// @flow
import * as React from 'react'
import {Text} from '../../common-adapters'
import {storiesOf} from '../../stories/storybook'

const load = () => {
  storiesOf('Login/Forms', module)
    .add('Intro', () => <Text>TODO</Text>)
    .add('Splash', () => <Text>TODO</Text>)
    .add('Failure', () => <Text>TODO</Text>)
}

export default load
