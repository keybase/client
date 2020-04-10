import * as React from 'react'
import ContactsJoinedModal from './index.native'
import * as Sb from '../../stories/storybook'

const load = () => {
  Sb.storiesOf('Settings/Contacts', module).add('Contacts on Keybase', () => <ContactsJoinedModal />)
}

export default load
