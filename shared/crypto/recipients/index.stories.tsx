import * as React from 'react'
import * as Sb from '../../stories/storybook'
import Recipients from '.'

const oneUser = ['cecileb']
const muiltipleUsers = ['chris', 'cecileb', 'cdixon', 'max']

const store = Sb.createStoreWithCommon()

const load = () => {
  Sb.storiesOf('Crypto/Recipients', module)
    .addDecorator(Sb.updateStoreDecorator(store, _ => {}))
    .add('Empty', () => <Recipients />)

  Sb.storiesOf('Crypto/Recipients', module)
    .addDecorator(
      Sb.updateStoreDecorator(store, draftState => {
        draftState.crypto.encrypt.recipients = oneUser
      })
    )
    .add('Single User', () => <Recipients />)

  Sb.storiesOf('Crypto/Recipients', module)
    .addDecorator(
      Sb.updateStoreDecorator(store, draftState => {
        draftState.crypto.encrypt.recipients = muiltipleUsers
      })
    )
    .add('Multiple Users', () => <Recipients />)

  Sb.storiesOf('Crypto/Recipients', module)
    .addDecorator(
      Sb.updateStoreDecorator(store, draftState => {
        draftState.crypto.encrypt.recipients = muiltipleUsers
        draftState.crypto.encrypt.inProgress = true
      })
    )
    .add('Disabled (file operation in progress)', () => <Recipients />)
}

export default load
