// @flow
import * as React from 'react'
import * as PropProviders from '../../stories/prop-providers'
import PaperKey from '.'
import {action, storiesOf} from '../../stories/storybook'

const load = () => {
  storiesOf('Provision', module)
    .addDecorator(PropProviders.CommonProvider())
    .add('PaperKey', () => (
      <PaperKey
        hint="chill dog..."
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
