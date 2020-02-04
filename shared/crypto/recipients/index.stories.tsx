import * as React from 'react'
import * as Container from '../../util/container'
import * as Sb from '../../stories/storybook'
import Recipients from '.'

const oneUser = ['cecileb']
const muiltipleUsers = ['chris', 'cecileb', 'cdixon', 'max']

const store = Sb.createStoreWithCommon()

const load = () => {
  Sb.storiesOf('Crypto/Recipients', module)
    .addDecorator((story: any) => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Empty', () => <Recipients />)

  Sb.storiesOf('Crypto/Recipients', module)
    .addDecorator((story: any) => (
      <Sb.MockStore
        store={Container.produce(store, draftState => {
          draftState.crypto.encrypt.recipients = oneUser
        })}
      >
        {story()}
      </Sb.MockStore>
    ))
    .add('Single User', () => <Recipients />)

  Sb.storiesOf('Crypto/Recipients', module)
    .addDecorator((story: any) => (
      <Sb.MockStore
        store={Container.produce(store, draftState => {
          draftState.crypto.encrypt.recipients = muiltipleUsers
        })}
      >
        {story()}
      </Sb.MockStore>
    ))
    .add('Multiple Users', () => <Recipients />)
}

export default load
