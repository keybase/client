// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import ConfirmSend from '.'

// TODO some of the state of these child components
// may be held completely by the parent form. Figure out a
// good level of connected granularity while implementing
// TODO fill these out
const provider = Sb.createPropProviderWithCommon({
  // TODO mock out meaningful values once type `OwnProps` is defined
  Available: props => ({}),
  Banner: props => ({}),
  Body: props => ({}),
  Footer: props => ({}),
  Header: props => ({}),
  NoteAndMemo: props => ({
    encryptedNote: `
      Lorem ipsum dolor sit amet consectetur, adipisicing elit. Soluta, officia tenetur nobis eveniet a consectetur at laboriosam et necessitatibus provident in eos perferendis?

      Optio dolor inventore esse vel, explicabo non molestias autem perspiciatis facilis pariatur illum. Quia suscipit tenetur enim.
    `,
    publicMemo: '💩',
  }),
  Participants: props => ({}),
})

const confirmProps = {
  amount: '1.234 XLM',
  assetType: 'lumens',
  assetConversion: '$3',
  onClose: Sb.action('onClose'),
  onBack: Sb.action('onBack'),
  onSendClick: Sb.action('onSendClick'),
}

const load = () => {
  Sb.storiesOf('Wallets/SendForm/Confirm', module)
    .addDecorator(provider)
    .add('Normal', () => <ConfirmSend {...confirmProps} />)
    .add('With a banner', () => (
      <ConfirmSend
        {...confirmProps}
        bannerBackground="Announcements"
        bannerText="The conversion rate has changed since you got to this screen."
      />
    ))
}

export default load
