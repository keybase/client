import * as React from 'react'
import ContactsJoinedModal from '.'
import {storiesOf} from '../../stories/storybook'

const props = {
  people: [
    {username: 'marcopolo', contactLabel: 'Marco'},
    {username: 'chris', contactLabel: 'Coyne'},
    {username: 'cecileb', contactLabel: '+1 (347) 555-8978'},
    {username: 'elliott', contactLabel: 'Elliott Smith'},
  ],
}

const load = () => {
  storiesOf('Settings/Contacts', module).add('Contacts on Keybase', () => <ContactsJoinedModal {...props} />)
}

export default load
