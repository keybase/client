// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import ConfirmSend from '.'

// TODO some of the state of these child components
// may be held completely by the parent form. Figure out a
// good level of connected granularity while implementing
// TODO fill these out
const provider = Sb.createPropProviderWithCommon({
  // TODO mock out meaningful values once type `OwnProps` is defined
  Available: props => ({}),
  Body: props => ({}),
  Footer: props => ({}),
  Header: props => ({}),
  Participants: props => ({}),
})

const confirmProps = {
  amount: '1.234 XLM',
  assetType: 'lumens',
  assetConversion: '$3',
  onClose: Sb.action('onClose'),
  onBack: Sb.action('onBack'),
  onSendClick: Sb.action('onSendClick'),
  waiting: false,
  yourUsername: 'cecileb',
  yourWalletName: "cecileb's wallet",
  yourWalletContents: '280.0871234 XLM',
  receiverUsername: 'nathunsmitty',
  receiverFullName: 'Nathan Smith',
}

const publicMemo = "Here's some lumens!"
const encryptedNote = `Lorem ipsum dolor sit amet consectetur adipisicing elit. Ex, dolorem commodi? Qui ullam accusantium perferendis mollitia fugit quas nobis tenetur expedita enim a molestias eligendi voluptas perspiciatis, earum vero tempore explicabo placeat, repellendus fugiat ducimus sed! Architecto, rem, distinctio similique, velit in sapiente eius nesciunt dolores asperiores dolorem quos vel.

Lorem ipsum dolor sit amet, consectetur adipisicing elit.
`
const banner = {
  bannerBackground: 'Announcements',
  bannerText: 'The conversion rate has changed since you got to this screen.',
}

const load = () => {
  Sb.storiesOf('Wallets/ConfirmForm', module)
    .addDecorator(provider)
    .add('Normal', () => <ConfirmSend {...confirmProps} />)
    .add('Waiting', () => <ConfirmSend {...confirmProps} waiting={true} />)
    .add('With a public memo', () => <ConfirmSend {...confirmProps} publicMemo={publicMemo} />)
    .add('With an encrypted note', () => <ConfirmSend {...confirmProps} encryptedNote={encryptedNote} />)
    .add('With a public memo and encrypted note', () => (
      <ConfirmSend {...confirmProps} publicMemo={publicMemo} encryptedNote={encryptedNote} />
    ))
    .add('With a banner', () => <ConfirmSend {...confirmProps} {...banner} />)
    .add('With a public memo, encrypted note, and banner', () => (
      <ConfirmSend {...confirmProps} publicMemo={publicMemo} encryptedNote={encryptedNote} {...banner} />
    ))
}

export default load
