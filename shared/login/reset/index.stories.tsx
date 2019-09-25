import * as React from 'react'
import * as Sb from '../../stories/storybook'
import resetModal from '../reset-modal/index.stories'
import {KnowPassword, EnterPassword} from './password'
import ConfirmReset from './confirm'
const store = Sb.createStoreWithCommon()

import Waiting from './waiting'
const load = () => {
  resetModal()

  Sb.storiesOf('Login/Reset', module)
    .addDecorator((story: any) => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Do you know your password?', () => <KnowPassword />)
    .add('Enter password', () => <EnterPassword />)
    .add('Waiting', () => <Waiting time="7 days" pipelineStarted={true} />)
    .add('Check phone', () => <Waiting pipelineStarted={false} />)
    .add('Waiting more', () => <Waiting time="2 days" pipelineStarted={true} />)
    .add('Confirm w/out wallet', () => <ConfirmReset hasWallet={false} />)
    .add('Confirm w/ wallet', () => <ConfirmReset hasWallet={true} />)
}
export default load
