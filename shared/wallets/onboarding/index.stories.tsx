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

const disclaimerSections = [
  {
    icon: '',
    lines: [
      {bullet: false, text: 'We believe Keybase can help make cryptocurrency usable for 2 reasons:'},
      {
        bullet: true,
        text:
          'we can make your Stellar private key sync with encryption across your devices, without exposing it to our servers. cool!',
      },
      {
        bullet: true,
        text:
          'we can help you send and receive crypto just by knowing usernames. You can say goodbye to ugly "addresses" you have to pass around insecurely.',
      },
      {bullet: false, text: 'And we believe Stellar is in _a unique position_ to solve payments because:'},
      {bullet: true, text: "it's ultra fast and ultra cheap"},
      {bullet: true, text: 'it natively understands currencies and tokens'},
      {bullet: true, text: "it's ultra fast and ultra cheap"},
      {bullet: true, text: 'the network itself has a decentralized exchange built into it'},
      {bullet: true, text: "it doesn't burn more electricity than small nations"},
      {
        bullet: false,
        text: 'But there are a few things you must agree to understand before using Stellar on Keybase:',
      },
      {
        bullet: false,
        text:
          "   1. IT'S BRAND NEW AND YOU ARE AMONG ITS FIRST TESTERS. Seriously, don't race off and buy more cryptocurrency than you're willing to lose. And don't manage tokens in Keybase that you're not willing to lose. We could have an exploitable bug in an early release. You're using this app at your own risk. *Keybase will not reimburse for any lost cryptocurrency due to user error or Keybase error of any kind.*",
      },
      {
        bullet: false,
        text:
          "   2. BY DESIGN, WE CAN'T RECOVER YOUR PRIVATE KEY. We don't actually hold your funds, we simply help you encrypt your keys. If you lose all your Keybase installs and paper keys, and if you haven't backed up your Stellar private key, you'll lose your Stellar account. Knowing your Keybase password is not enough info. Similarly, knowing your PGP private key isn't enough info. You must have access to a Keybase install (logged in as you) or Keybase paper key to recover your Stellar private key.",
      },
      {
        bullet: false,
        text:
          '    3. CRYPTOCURRENCY ISN\'T REALLY ANONYMOUS. When you sign your first or "default" Stellar address into your signature chain on Keybase, you are announcing it publicly as a known address for you. Assume that all your transactions from that account are public. You can have as many Stellar accounts as you like in Keybase, but whenever you make one your default, that one is then announced as yours. Consider that data permanent.',
      },
      {
        bullet: false,
        text:
          "   4. DON'T \"RESET\" YOUR KEYBASE ACCOUNT. If you reset your Keybase account, that will let you recover your Keybase username, by killing all your keys. You'll lose your Stellar account in Keybase. So don't do a Keybase account reset unless you've backed up your Stellar private key(s).",
      },
      {
        bullet: false,
        text:
          "   5. AVOID SOCIAL ATTACKS. People may beg of thee for thine cryptocurrency. Pay attention to usernames, not photos and full names. Follow people on Keybase, so they turn green, which is a cryptographically signed action. And don't ever install software that other people send you, even if you trust those people. That software may be some kind of social worm. Keybase cannot be responsible for lost tokens due to bugs, hacks, or social attacks. Or anything else for that matter.",
      },
      {bullet: false, text: '   6. FINALLY HAVE FUN WHILE YOU CAN. Something is coming.'},
    ],
    section: "Almost done.\\nIt's important you read this.",
  },
]
const load = () => {
  storiesOf('Wallets/Onboarding', module)
    .addDecorator(story => (
      <Box style={platformStyles({common: {maxWidth: 400, minHeight: 560}, isElectron: {height: 560}})}>
        {story()}
      </Box>
    ))
    .add('Intro', () => (
      <Intro
        headerBody="You can now send or request Stellar Lumens to any Keybase user on *Earth*. Transactions settle in seconds, and cost a fraction of a penny.\\n\\nWhen sending and receiving Lumens, we automatically do the conversion in your favorite currency. We went ahead and set it to *USD*."
        headerTitle="Keybase supports Stellar wallets."
        onClose={action('onClose')}
        onSeenIntro={action('onSeenIntro')}
      />
    ))
    .add('Disclaimer', () => (
      <Disclaimer
        {...actions}
        acceptDisclaimerError=""
        acceptingDisclaimerDelay={false}
        sections={disclaimerSections}
      />
    ))
    .add('Error accepting', () => (
      <Disclaimer
        {...actions}
        acceptDisclaimerError="There was an error accepting the disclaimer."
        acceptingDisclaimerDelay={false}
        sections={disclaimerSections}
      />
    ))
}

export default load
