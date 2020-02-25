import * as React from 'react'
import * as Sb from '../../stories/storybook'
import EnableContacts from './enable-contacts'
import AddEmail from './add-email'

const load = () => {
  Sb.storiesOf('Teams/Add member wizard', module).add('Enable contacts', () => (
    <EnableContacts onClose={Sb.action('onClose')} />
  ))

  Sb.storiesOf('Teams/Add by email wizard', module).add('Basic', () => (
    <AddEmail teamname="keybase" errorMessage="" />
  ))
}

export default load
