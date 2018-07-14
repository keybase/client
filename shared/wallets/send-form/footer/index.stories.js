// @flow
import * as React from 'react'
import {action, createPropProvider, storiesOf} from '../../../stories/storybook'
import {Box} from '../../../common-adapters'
import Footer from '.'

const provider = createPropProvider({
  // TODO mock out meaningful values once type `OwnProps` is defined
  Footer: props => ({}),
  Available: props => ({}),
})

const load = () => {
  const story = storiesOf('Wallets/SendForm/Footer', module).addDecorator(story => (
    <Box style={{maxWidth: 360}}>{story()}</Box>
  ))
  story.addDecorator(provider)
  story.add('Normal send', () => <Footer onClickSend={action('onClick')} />)
  story.add('Send with request', () => (
    <Footer onClickSend={action('onClick')} onClickRequest={action('onClick')} />
  ))
  story.add('Disabled', () => <Footer onClickSend={action('onClick')} disabled={true} />)
  story.add('Disabled with request', () => (
    <Footer onClickSend={action('onClick')} onClickRequest={action('onClick')} disabled={true} />
  ))
}

export default load
