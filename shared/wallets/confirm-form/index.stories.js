// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import participants from './participants/index.stories'
import ConfirmSend from '.'

// TODO some of the state of these child components
// may be held completely by the parent form. Figure out a
// good level of connected granularity while implementing
// TODO fill these out
const provider = Sb.createPropProviderWithCommon({
  Participants: props => ({
    fromAccountAssets: '280.0871234 XLM',
    fromAccountName: "cecileb's account",
    recipientAccountAssets: '534 XLM',
    recipientAccountName: 'Secondary Account',
    recipientFullName: 'Nathan Smith',
    recipientStellarAddress: 'G23T5671ASCZZX09235678ASQ511U12O91AQ',
    recipientType: 'keybaseUser',
    recipientUsername: 'nathunsmitty',
    yourUsername: 'cecileb',
  }),
})

const confirmProps = {
  amount: '1.234 XLM',
  assetConversion: '$3',
  assetType: 'lumens',
  onBack: Sb.action('onBack'),
  onClose: Sb.action('onClose'),
  onSendClick: Sb.action('onSendClick'),
  sendFailed: false,
  waiting: false,
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
  participants()
  Sb.storiesOf('Wallets/ConfirmForm', module)
    .addDecorator(provider)
    .add('To User', () => <ConfirmSend {...confirmProps} />)
    .add('Waiting', () => <ConfirmSend {...confirmProps} waiting={true} />)
    .add('With a public memo', () => <ConfirmSend {...confirmProps} publicMemo={publicMemo} />)
    .add('With an encrypted note', () => <ConfirmSend {...confirmProps} encryptedNote={encryptedNote} />)
    .add('With a public memo and encrypted note', () => (
      <ConfirmSend {...confirmProps} publicMemo={publicMemo} encryptedNote={encryptedNote} />
    ))
    .add('With a banner', () => <ConfirmSend {...confirmProps} {...banner} />)
    .add('With a public memo, encrypted note, and banner', () => (
      <ConfirmSend
        {...confirmProps}
        publicMemo={publicMemo}
        encryptedNote={encryptedNote}
        banners={[banner]}
      />
    ))
}

export default load
