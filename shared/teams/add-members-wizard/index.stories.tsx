import * as React from 'react'
import * as Sb from '../../stories/storybook'
import EnableContacts from './enable-contacts'

const load = () => {
  Sb.storiesOf('Teams/Add member wizard', module).add('Enable contacts', () => <EnableContacts />)
}

export default load
