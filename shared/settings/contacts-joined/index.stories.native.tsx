import * as React from 'react'
import ContactsJoinedModal from './index.native'
import * as Sb from '../../stories/storybook'

const props = {
  people: [
    {contactLabel: 'Marco', username: 'marcopolo'},
    {contactLabel: 'Coyne', username: 'chris'},
    {contactLabel: '+1 (347) 555-8978', username: 'cecileb'},
    {contactLabel: 'Elliott Smith', username: 'elliott'},
  ],
}

const load = () => {
  Sb.storiesOf('Settings/Contacts', module).add('Contacts on Keybase', () => (
    <ContactsJoinedModal {...Sb.createNavigator(props)} />
  ))
}

export default load
