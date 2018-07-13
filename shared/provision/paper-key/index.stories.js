// @flow
import * as React from 'react'
import PaperKey from '.'
import {action, storiesOf} from '../../stories/storybook'

const load = () => {
  storiesOf('Register', module).add('PaperKey', () => (
    <PaperKey
      onBack={action('onBack')}
      onSubmit={action('onSubmit')}
      onChangePaperKey={action('onChangePaperKey')}
      paperKey={''}
      waitingForResponse={false}
      error={''}
    />
  ))
}

export default load
