import * as React from 'react'
import * as Sb from '../../stories/storybook'
import Airdrop from '.'
import qualify from './qualify/index.stories'
import banner from './banner/index.stories'

const props = {
  headerBody:
    'Starting March 1, Keybase will divide *50,000 XLM* (Stellar Lumens) among qualified Keybase users, every month.',
  headerTitle: 'Get free lumens every month',
  loading: false,
  onBack: Sb.action('onBack'),
  onCheckQualify: Sb.action('onCheckQualify'),
  onLoad: Sb.action('onLoad'),
  onReject: Sb.action('onReject'),
  sections: [
    {
      icon: '',
      lines: [{bullet: false, text: 'See it as the Robin Hood of crypto money. '}],
      section: 'What is this?',
    },
    {
      icon: '',
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
      icon: '',
      lines: [
        {bullet: false, text: 'Your fraction of the 50,000 XLM will fall straight into your default wallet.'},
      ],
      section: 'Where are the Lumens dropped?',
    },
    {
      icon: 'icon-fancy-user-card-desktop-airdrop-80-99',
      lines: [{bullet: false, text: "You'll earn a golden Stellar symbol, visbile on your profile"}],
      section: 'Anything else to know?',
    },
  ],
  signedUp: false,
  title: '',
}

const noIconSections = props.sections.map(b => ({...b, icon: null}))
const badIconSections = props.sections.map(b => ({...b, icon: 'not a real icon'}))

const load = () => {
  Sb.storiesOf('Settings/AirdropDetails', module)
    .add('Participating', () => <Airdrop {...props} signedUp={true} />)
    .add('Loading', () => <Airdrop {...props} loading={true} />)
    .add('Participating no image', () => <Airdrop {...props} signedUp={true} sections={noIconSections} />)
    .add('Participating bad image', () => <Airdrop {...props} signedUp={true} sections={badIconSections} />)
    .add('Not Participating', () => <Airdrop {...props} />)
  qualify()
  banner()
}

export default load
