// @flow
import React from 'react'
import {action, createPropProvider, storiesOf} from '../../stories/storybook'
import assetInput, {props3 as assetInputProps} from './asset-input/index.stories'
import banner from './banner/index.stories'
import SendForm from '.'

// TODO some of the state of these child components
// may be held completely by the parent form. Figure out a
// good level of connected granularity while implementing
// TODO fill these out
const provider = createPropProvider({
  // TODO mock out meaningful values once type `OwnProps` is defined
  AssetInput: props => assetInputProps,
  Available: props => ({}),
  Banner: props => ({}),
  Body: props => ({}),
  Footer: props => ({}),
  Header: props => ({}),
  Memo: props => ({}),
  Note: props => ({}),
  Participants: props => ({}),
})

const load = () => {
  // dumb component stories
  assetInput()
  banner()

  // full component
  storiesOf('Wallets/SendForm', module)
    .addDecorator(provider)
    .add('Send', () => <SendForm onClick={action('onClick')} />)
}

export default load
