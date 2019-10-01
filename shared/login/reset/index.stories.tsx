import * as React from 'react'
import * as Sb from '../../stories/storybook'
import ResetModal from './modal'
import {KnowPassword, EnterPassword} from './password'
import Waiting from './waiting'
import ConfirmReset from './confirm'

const store = Sb.createStoreWithCommon()

const load = () => {
  Sb.storiesOf('Login/Reset', module)
    .addDecorator((story: any) => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Modal', () => <ResetModal />)
    .add('Waiting', () => <Waiting pipelineStarted={true} />)
    .add('Check phone', () => <Waiting pipelineStarted={false} />)
    .add('Do you know your password?', () => <KnowPassword />)
    .add('Enter password', () => <EnterPassword />)
    .add('Confirm w/out wallet', () => <ConfirmReset hasWallet={false} />)
    .add('Confirm w/ wallet', () => <ConfirmReset hasWallet={true} />)
}
export default load
