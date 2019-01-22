// @flow
import * as React from 'react'
import {action, storiesOf} from '../../stories/storybook'
import ProveWebsiteChoice from '.'

const load = () => {
  storiesOf('Profile/ProveWebsiteChoice', module).add('DNS or File', () => (
    <ProveWebsiteChoice
      leftAction="cancel"
      onLeftAction={action('onLeftAction')}
      onOptionClick={action('onOptionClick')}
    />
  ))
}

export default load
