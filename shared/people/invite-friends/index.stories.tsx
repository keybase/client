import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Container from '../../util/container'
import InviteFriends from '.'

const store = Container.produce(Sb.createStoreWithCommon(), draftState => {
  draftState.settings.phoneNumbers.defaultCountry = 'FR'
})

const load = () => {
  Sb.storiesOf('Invite friends', module)
    .addDecorator(story => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
    .add('Modal', () => <InviteFriends />)
}

export default load
