import * as React from 'react'
import * as Sb from '../../stories/storybook'
import Waiting from './waiting'
const load = () => {
  Sb.storiesOf('Login/Reset', module)
    .add('Waiting', () => <Waiting time="7 days" pipelineStarted={true} />)
    .add('Check phone', () => <Waiting pipelineStarted={false} />)
    .add('Waiting more', () => <Waiting time="2 days" pipelineStarted={true} />)
}
export default load
