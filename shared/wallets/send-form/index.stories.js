// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import assetInput, {props4 as assetInputProps} from './asset-input/index.stories'
import chooseAsset from './choose-asset/index.stories'
import footers from './footer/index.stories'
import noteAndMemo from './note-and-memo/index.stories'
import participants, {participantProviderProperties} from './participants/index.stories'

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
  Body: props => ({
    banners: [],
    isProcessing: props.isProcessing,
    isRequest: props.isRequest,
  }),
  Footer: props => ({
    isRequest: props.isRequest,
    onClickRequest: props.isRequest ? Sb.action('onClickRequest') : undefined,
    onClickSend: Sb.action('onClickSend'),
  }),
  Header: props => ({}),
  NoteAndMemo: props => ({}),
  Participants: props => ({
    onShowProfile: Sb.action('onShowProfile'),
    onShowSuggestions: Sb.action('onShowSuggestions'),
  }),
  Root: props => ({
    onClose: Sb.action('onClose'),
    onLinkAccount: Sb.action('onLinkAccount'),
    onCreateNewAccount: Sb.action('onCreateNewAccount'),
    isProcessing: props.isProcessing,
    isRequest: props.isRequest,
  }),
  ...participantProviderProperties,
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
    .add('Send', () => <SendForm isRequest={false} onClose={Sb.action('onClose')} />)
    .add('Request', () => <SendForm isRequest={true} onClose={Sb.action('onClose')} />)
}

export default load
