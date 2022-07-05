import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import {Box} from '../../../common-adapters'
import Footer from '.'

const provider = Sb.createPropProviderWithCommon({
  // TODO mock out meaningful values once type `OwnProps` is defined
  Available: () => ({}),
  Footer: () => ({}),
})

const common = {
  calculating: false,
  disabled: false,
  onClickSend: Sb.action('onClickSend'),
  thisDeviceIsLockedOut: false,
  waitingKey: 'wallets:buildPayment',
}

const onClickRequest = Sb.action('onClickRequest')

const load = () => {
  const story = Sb.storiesOf('Wallets/SendForm/Footer', module).addDecorator(story => (
    <Box style={{maxWidth: 400}}>{story()}</Box>
  ))
  story.addDecorator(provider)
  story.add('Normal send', () => <Footer {...common} />)
  story.add('Send with request', () => <Footer {...common} onClickRequest={onClickRequest} />)
  story.add('Disabled', () => <Footer {...common} disabled={true} />)
  story.add('Disabled with request', () => (
    <Footer {...common} onClickRequest={onClickRequest} disabled={true} />
  ))
  story.add('With worth description', () => (
    <Footer {...common} onClickRequest={onClickRequest} worthDescription="$1.23" />
  ))
}

export default load
