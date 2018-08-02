// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import {Box} from '../../../common-adapters'
import Footer from '.'

const provider = Sb.createPropProviderWithCommon({
  // TODO mock out meaningful values once type `OwnProps` is defined
  Footer: props => ({}),
  Available: props => ({}),
})

const load = () => {
  const story = Sb.storiesOf('Wallets/SendForm/Footer', module).addDecorator(story => (
    <Box style={{maxWidth: 360}}>{story()}</Box>
  ))
  story.addDecorator(provider)
  story.add('Normal send', () => <Footer onClickSend={Sb.action('onClick')} />)
  story.add('Send with request', () => (
    <Footer onClickSend={Sb.action('onClick')} onClickRequest={Sb.action('onClick')} />
  ))
  story.add('Disabled', () => <Footer onClickSend={Sb.action('onClick')} disabled={true} />)
  story.add('Disabled with request', () => (
    <Footer onClickSend={Sb.action('onClick')} onClickRequest={Sb.action('onClick')} disabled={true} />
  ))
}

export default load
