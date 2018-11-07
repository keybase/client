// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import assetInput, {props4 as assetInputProps} from './asset-input/index.stories'
import chooseAsset from './choose-asset/index.stories'
import footers from './footer/index.stories'
import noteAndMemo from './note-and-memo/index.stories'
import participants from './participants/index.stories'
import type {Props as AvailableProps} from './available'

import SendRequestForm from '.'

// TODO some of the state of these child components
// may be held completely by the parent form. Figure out a
// good level of connected granularity while implementing
// TODO fill these out
const provider = Sb.createPropProviderWithCommon({
  // TODO mock out meaningful values once type `OwnProps` is defined
  AssetInput: props => assetInputProps,
  Available: props => ({amountErrMsg: ''}: AvailableProps),
  Banner: props => ({}),
  ConnectedSendBody: props => ({
    banners: [],
    isProcessing: props.isProcessing,
  }),
  ConnectedRequestBody: props => ({
    banners: [],
    isProcessing: props.isProcessing,
  }),
  Footer: props => ({
    isRequest: props.isRequest,
    onClickRequest: props.isRequest ? Sb.action('onClickRequest') : undefined,
    onClickSend: props.isRequest ? undefined : Sb.action('onClickSend'),
  }),
  Header: props => ({}),
  ConnectedSecretNote: props => ({onChangeSecretNote: Sb.action('onChangeSecretNote')}),
  ConnectedPublicMemo: props => ({onChangePublicMemo: Sb.action('onChangePublicMemo')}),
  Participants: props => ({
    recipientType: 'keybaseUser',
  }),
  ParticipantsKeybaseUser: propd => ({
    isRequest: false,
    recipientUsername: 'chris',
    onShowProfile: Sb.action('onShowProfile'),
    onShowSuggestions: Sb.action('onShowSuggestions'),
    onRemoveProfile: Sb.action('onRemoveProfile'),
    onChangeRecipient: Sb.action('onChangeRecipient'),
  }),
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
    .add('Send', () => <SendRequestForm isRequest={false} onClose={Sb.action('onClose')} />)
    .add('Request', () => <SendRequestForm isRequest={true} onClose={Sb.action('onClose')} />)
}

export default load
