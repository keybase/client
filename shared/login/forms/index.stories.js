// @flow
import * as React from 'react'
import {Text} from '../../common-adapters'
import {storiesOf} from '../../stories/storybook'

const load = () => {
  storiesOf('Login/Forms', module)
    .add('Intro', () => <Text type="Body">TODO</Text>)
    .add('Splash', () => <Text type="Body">TODO</Text>)
    .add('Failure', () => <Text type="Body">TODO</Text>)
}

export default load
