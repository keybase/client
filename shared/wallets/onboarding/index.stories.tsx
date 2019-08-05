import * as React from 'react'
import {action, storiesOf} from '../../stories/storybook'
import {Box} from '../../common-adapters'
import {platformStyles} from '../../styles'
import Disclaimer from './disclaimer'
import Intro from './intro'

const actions = {
  onAcceptDisclaimer: action('onAcceptDisclaimer'),
  onCheckDisclaimer: action('onCheckDisclaimer'),
  onNotNow: action('onNotNow'),
}

const load = () => {
  storiesOf('Wallets/Onboarding', module)
    .addDecorator(story => (
      <Box style={platformStyles({common: {maxWidth: 400, minHeight: 560}, isElectron: {height: 560}})}>
        {story()}
      </Box>
    ))
    .add('Intro', () => <Intro onClose={action('onClose')} onSeenIntro={action('onSeenIntro')} />)
    .add('Disclaimer', () => (
      <Disclaimer {...actions} acceptDisclaimerError="" acceptingDisclaimerDelay={false} />
    ))
    .add('Error accepting', () => (
      <Disclaimer
        {...actions}
        acceptDisclaimerError="There was an error accepting the disclaimer."
        acceptingDisclaimerDelay={false}
      />
    ))
}

export default load
