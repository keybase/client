// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import assetInput, {props3 as assetInputProps} from './asset-input/index.stories'
import chooseAsset from './choose-asset/index.stories'
import footers from './footer/index.stories'
import noteAndMemo from './note-and-memo/index.stories'
import participants from './participants/index.stories'
import SendForm from '.'

// TODO some of the state of these child components
// may be held completely by the parent form. Figure out a
// good level of connected granularity while implementing
// TODO fill these out
const provider = Sb.createPropProviderWithCommon({
  // TODO mock out meaningful values once type `OwnProps` is defined
  AssetInput: props => assetInputProps,
  Available: props => ({}),
  Banner: props => ({}),
  Body: props => ({}),
  Footer: props => ({}),
  Header: props => ({}),
  NoteAndMemo: props => ({}),
  Participants: props => ({}),
})

const load = () => {
  // dumb component stories
  assetInput()
  chooseAsset()
  footers()
  noteAndMemo()
  participants()
  // full component
  Sb.storiesOf('Wallets/SendForm', module)
    .addDecorator(provider)
    .add('Send', () => (
      <SendForm isRequest={false} onClick={Sb.action('onClick')} onClose={Sb.action('onClose')} />
    ))
}

export default load
