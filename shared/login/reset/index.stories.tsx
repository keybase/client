import * as React from 'react'
import * as Sb from '../../stories/storybook'
import Waiting from './waiting'
const load = () => {
  Sb.storiesOf('Login/Reset', module)
    .add('Waiting', () => <Waiting time="7 days" hasPW={true} />)
    .add('Check phone', () => <Waiting hasPW={false} />)
    .add('Waiting more', () => <Waiting time="2 days" hasPW={true} />)
}
export default load
