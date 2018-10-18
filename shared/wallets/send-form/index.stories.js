// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import assetInput, {props4 as assetInputProps} from './asset-input/index.stories'
import chooseAsset from './choose-asset/index.stories'
import footers from './footer/index.stories'
import noteAndMemo from './note-and-memo/index.stories'
import participants, {participantProviderProperties} from './participants/index.stories'
import type {Props as AvailableProps} from './available'

import SendRequestForm from '.'

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
  Sb.storiesOf('Wallets/Wallet Form', module)
    .addDecorator(provider)
    .add('Send', () => <SendRequestForm isRequest={false} onClose={Sb.action('onClose')} />)
    .add('Request', () => <SendRequestForm isRequest={true} onClose={Sb.action('onClose')} />)
}

export default load
