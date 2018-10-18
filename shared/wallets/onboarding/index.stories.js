// @flow
import * as React from 'react'
import {action, storiesOf} from '../../stories/storybook'
import {Box} from '../../common-adapters'
import {platformStyles} from '../../styles'
import Disclaimer from './disclaimer'
import Intro from './intro'

const load = () => {
  storiesOf('Wallets/Onboarding', module)
    .addDecorator(story => (
      <Box style={platformStyles({common: {minHeight: 525, maxWidth: 360}, isElectron: {height: 525}})}>
        {story()}
      </Box>
    ))
    .add('Intro', () => <Intro onClose={action('onClose')} setNextScreen={action('setNextScreen')} />)
    .add('Disclaimer', () => (
      <Disclaimer onAcceptDisclaimer={action('onAcceptDisclaimer')} onNotNow={action('onNotNow')} />
    ))
}

export default load
