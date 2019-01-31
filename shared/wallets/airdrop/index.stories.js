// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import Airdrop from '.'
import qualify from './qualify/index.stories'
import banner from './banner/index.stories'

const props = {
  body: [
    {
      lines: [{bullet: false, text: 'See it as the Robin Hood of crypto money. '}],
      section: 'What is this?',
    },
    {
      lines: [
        {bullet: false, text: 'Keybase users who:'},
        {bullet: true, text: 'have at least 3 devices or paper keys'},
        {
          bullet: true,
          text: 'have a Keybase, Github or Hacker News account that was registered before July 1, 2018.',
        },
      ],
      section: 'Who qualifies?',
    },
    {
      lines: [
        {bullet: false, text: 'Your fraction of the 50,000 XLM will fall straight into your default wallet.'},
      ],
      section: 'Where are the Lumens dropped?',
    },
    {
      icon: 'icon-fancy-no-access-desktop-96-94',
      lines: [{bullet: false, text: "You'll earn a star, visbile on your profile"}],
      section: 'Anything else to know?',
    },
  ],
  loading: false,
  onBack: Sb.action('onBack'),
  onCheckQualify: Sb.action('onCheckQualify'),
  onReject: Sb.action('onReject'),
  signedUp: false,
}

const noIconBody = props.body.map(b => ({...b, icon: null}))
const badIconBody = props.body.map(b => ({...b, icon: 'not a real icon'}))

const load = () => {
  Sb.storiesOf('Settings/AirdropSettings', module)
    .add('Participating', () => <Airdrop {...props} signedUp={true} />)
    .add('Loading', () => <Airdrop {...props} loading={true} />)
    .add('Participating no image', () => <Airdrop {...props} signedUp={true} body={noIconBody} />)
    .add('Participating bad image', () => <Airdrop {...props} signedUp={true} body={badIconBody} />)
    .add('Not Participating', () => <Airdrop {...props} />)
  qualify()
  banner()
}

export default load
