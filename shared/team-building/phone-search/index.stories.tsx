import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as I from 'immutable'
import PhoneSearch from './index'

const load = () => {
  Sb.storiesOf('Team-Building', module).add('Phone Search', () => (
    <PhoneSearch
      onChangeNumber={Sb.action('onChangeNumber')}
      assertionToContactMap={I.Map()}
      onContinue={Sb.action('onContinue')}
    />
  ))
}

export default load
