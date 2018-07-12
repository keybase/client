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
  story.add('Normal send', () => <Footer onClick={action('onClick')} />)
  story.add('Send with request', () => <Footer onClick={action('onClick')} withRequest={true} />)
  story.add('Disabled', () => <Footer onClick={action('onClick')} disabled={true}/>)
  story.add('Disalbed with recieve', () => <Footer onClick={action('onClick')} withRequest={true} disabled={true}/>)
}

export default load
