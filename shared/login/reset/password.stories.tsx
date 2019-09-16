import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {KnowPassword, EnterPassword} from './password'

const load = () => {
  Sb.storiesOf('Login/Reset', module)
    .add('Do you know your password?', () => <KnowPassword />)
    .add('Enter password', () => <EnterPassword />)
}

export default load
