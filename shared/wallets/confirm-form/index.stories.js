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
    fromAccountName: '2nd',
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
  displayAmountFiat: '$3.00 USD',
  displayAmountXLM: '1.234 XLM',
  onBack: Sb.action('onBack'),
  onClose: Sb.action('onClose'),
  onSendClick: Sb.action('onSendClick'),
  readyToSend: 'enabled',
  sendFailed: false,
  sendingIntentionXLM: true,
  waitingKey: 'false',
}

const publicMemo = "Here's some Lumens!"
const encryptedNote = `Lorem ipsum dolor sit amet consectetur adipisicing elit. Ex, dolorem commodi? Qui ullam accusantium perferendis mollitia fugit quas nobis tenetur expedita enim a molestias eligendi voluptas perspiciatis, earum vero tempore explicabo placeat, repellendus fugiat ducimus sed! Architecto, rem, distinctio similique, velit in sapiente eius nesciunt dolores asperiores dolorem quos vel.

Lorem ipsum dolor sit amet, consectetur adipisicing elit.
`
const banner = {
  bannerBackground: 'Announcements',
  bannerText: 'The conversion rate has changed since you got to this screen.',
}

const sendFailedBanner = {
  action: Sb.action('onExitFailed'),
  bannerBackground: 'HighRisk',
  bannerText:
    'The request to the stellar network timed out. Please make sure your payment failed before trying again.',
  sendFailed: true,
}

const load = () => {
  participants()
  Sb.storiesOf('Wallets/ConfirmForm', module)
    .addDecorator(provider)
    .add('To User', () => <ConfirmSend {...confirmProps} />)
    .add('Waiting', () => <ConfirmSend {...confirmProps} waitingKey="true" />)
    .add('With a public memo', () => <ConfirmSend {...confirmProps} publicMemo={publicMemo} />)
    .add('With an encrypted note', () => <ConfirmSend {...confirmProps} encryptedNote={encryptedNote} />)
    .add('With a public memo and encrypted note', () => (
      <ConfirmSend {...confirmProps} publicMemo={publicMemo} encryptedNote={encryptedNote} />
    ))
    .add('With a banner', () => <ConfirmSend {...confirmProps} banners={[banner]} />)
    .add('With a public memo, encrypted note, and banner', () => (
      <ConfirmSend
        {...confirmProps}
        publicMemo={publicMemo}
        encryptedNote={encryptedNote}
        banners={[banner]}
      />
    ))
    .add('With a payment failed banner', () => <ConfirmSend {...confirmProps} banners={[sendFailedBanner]} />)
}

export default load
