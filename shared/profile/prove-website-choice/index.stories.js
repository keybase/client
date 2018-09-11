// @flow
import * as React from 'react'
import {action, storiesOf} from '../../stories/storybook'
import ProveWebsiteChoice from '.'

const load = () => {
  storiesOf('Profile/ProveWebsiteChoice', module).add('DNS or File', () => (
    <ProveWebsiteChoice onCancel={action('onCancel')} onOptionClick={action('onOptionClick')} />
  ))
}

export default load
