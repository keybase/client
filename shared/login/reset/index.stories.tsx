import * as React from 'react'
import * as Sb from '../../stories/storybook'
import ResetModal from './modal'
import {KnowPassword, EnterPassword} from './password'
import Waiting from './waiting'
import ConfirmReset from './confirm'
import * as Container from '../../util/container'

const store = Container.produce(Sb.createStoreWithCommon(), draftState => {
  draftState.autoreset.active = true
})

const load = () => {
  Sb.storiesOf('Login/Reset', module)
    .addDecorator((story: any) => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Modal', () => <ResetModal />)
    .add('Waiting', () => <Waiting {...Sb.createNavigator({pipelineStarted: true})} />)
    .add('Check phone', () => <Waiting {...Sb.createNavigator({pipelineStarted: false})} />)
    .add('Do you know your password?', () => <KnowPassword />)
    .add('Enter password', () => <EnterPassword />)
    .add('Waiting', () => <Waiting {...Sb.createNavigator({pipelineStarted: true})} />)
    .add('Check phone', () => <Waiting {...Sb.createNavigator({pipelineStarted: false})} />)
    .add('Confirm', () => <ConfirmReset />)
}
export default load
