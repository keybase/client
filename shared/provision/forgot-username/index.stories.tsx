import * as React from 'react'
import * as Sb from '../../stories/storybook'
import ForgotUsername from '.'
import * as Constants from '../../constants/provision'

const store = Sb.createStoreWithCommon()

const load = () => {
  Sb.storiesOf('Provision/ForgotUsername', module)
    .addDecorator(
      Sb.updateStoreDecorator(store, draftState => {
        draftState.provision = {
          ...Constants.makeState(),
          forgotUsernameResult: 'success',
        }
      })
    )
    .add('Success', () => <ForgotUsername />)

  Sb.storiesOf('Provision/ForgotUsername', module)
    .addDecorator(
      Sb.updateStoreDecorator(store, draftState => {
        draftState.provision = {
          ...Constants.makeState(),
          forgotUsernameResult: `We couldn't find an account with that email address. Try again?`,
        }
      })
    )
    .add('Error', () => <ForgotUsername />)
}

export default load
