import * as React from 'react'
import * as Sb from '../../stories/storybook'
import ForgotUsername from '.'
import * as Container from '../../util/container'
import * as Constants from '../../constants/provision'

const makeStore = (msg: string) =>
  Container.produce(Sb.createStoreWithCommon(), draftState => {
    draftState.provision = {
      ...Constants.makeState(),
      forgotUsernameResult: msg,
    }
  })

const load = () => {
  Sb.storiesOf('Provision/ForgotUsername', module)
    .add('Success', () => (
      <Sb.MockStore store={makeStore('success')}>
        <ForgotUsername />
      </Sb.MockStore>
    ))
    .add('Error', () => (
      <Sb.MockStore store={makeStore(`We couldn't find an account with that email address. Try again?`)}>
        <ForgotUsername />
      </Sb.MockStore>
    ))
}

export default load
