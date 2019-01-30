// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Kb from '../../common-adapters'
import Airdrop from '.'
import qualify from './qualify/index.stories'
import banner from './banner/index.stories'

const props = {
  body: [
    {
      lines: ['See it as the Robin Hood of crypto money. '],
      section: 'What is this?',
    },
    {
      lines: [
        'Keybase users who:',
        '	• 	have at least 3 devices or paper keys',
        '	• 	have a Keybase, Github or Hacker News account that was registered before July 1, 2018.',
      ],
      section: 'Who qualifies?',
    },
    {
      lines: ['Your fraction of the 50,000 XLM will fall straight into your default wallet.'],
      section: 'Where are the Lumens dropped?',
    },
  ],
  onCheckQualify: Sb.action('onCheckQualify'),
  signedUp: false,
}

const load = () => {
  Sb.storiesOf('Settings/AirdropSettings', module)
    .add('Participating', () => <Airdrop {...props} />)
    .add('Not Participating', () => <Airdrop {...props} signedUp={false} />)
  qualify()
  banner()
}

export default load
