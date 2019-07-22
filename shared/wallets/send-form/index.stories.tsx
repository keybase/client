import * as React from 'react'
import * as Sb from '../../stories/storybook'
import assetInput, {props4 as assetInputProps} from './asset-input/index.stories'
import chooseAsset from './choose-asset/index.stories'
import footers from './footer/index.stories'
import noteAndMemo from './note-and-memo/index.stories'
import participants from './participants/index.stories'

import SendRequestForm from '.'
import {AdvancedBanner} from '../../constants/types/rpc-stellar-gen'

// TODO some of the state of these child components
// may be held completely by the parent form. Figure out a
// good level of connected granularity while implementing
// TODO fill these out
const provider = banner =>
  Sb.createPropProviderWithCommon({
    // TODO mock out meaningful values once type `OwnProps` is defined
    AssetInputBasic: () => assetInputProps,

    Available: () => ({amountErrMsg: ''}),
    Banner: () => ({}),
    ConnectedPublicMemo: () => ({maxLength: 28, onChangePublicMemo: Sb.action('onChangePublicMemo')}),
    ConnectedRequestBody: props => ({
      banners: [],
      isProcessing: props.isProcessing,
    }),
    ConnectedSecretNote: () => ({maxLength: 500, onChangeSecretNote: Sb.action('onChangeSecretNote')}),
    ConnectedSendBody: props => ({
      banners: JSON.stringify(banner) === '{}' ? [] : [banner],
      isProcessing: props.isProcessing,
    }),
    ConnectedSendBodyAdvanced: props => ({
      banners: [],
      isProcessing: props.isProcessing,
    }),
    Footer: props => ({
      isRequest: props.isRequest,
      onClickRequest: props.isRequest ? Sb.action('onClickRequest') : undefined,
      onClickSend: props.isRequest ? undefined : Sb.action('onClickSend'),
    }),
    Header: () => ({}),
    Participants: () => ({recipientType: 'keybaseUser'}),
    ParticipantsKeybaseUser: () => ({
      isRequest: false,
      onChangeRecipient: Sb.action('onChangeRecipient'),
      onRemoveProfile: Sb.action('onRemoveProfile'),
      onShowProfile: Sb.action('onShowProfile'),
      onShowSuggestions: Sb.action('onShowSuggestions'),
      recipientUsername: 'chris',
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
    /*
    .add('Send - advanced', () => (
      <SendRequestForm
        onBack={Sb.action('onBack')}
        isAdvanced={true}
        isRequest={false}
        onClose={Sb.action('onClose')}
      />
    ))
    .add('Request - advanced', () => (
      <SendRequestForm
        onBack={Sb.action('onBack')}
        isAdvanced={true}
        isRequest={true}
        onClose={Sb.action('onClose')}
      />
    ))
    .add('PickAsset - sender', () => <PickAsset isSender={true} />)
    .add('PickAsset - recipient keybaseUser', () => <PickAsset isSender={false} username="songgao" />)
    .add('PickAsset - recipient stellar', () => <PickAsset isSender={false} />)
     */
    .addDecorator(provider({}))
    .add('Send', () => (
      <SendRequestForm
        isRequest={false}
        isAdvanced={false}
        onBack={Sb.action('onBack')}
        onClose={Sb.action('onClose')}
      />
    ))
    .add('Request', () => (
      <SendRequestForm
        isRequest={true}
        isAdvanced={false}
        onBack={Sb.action('onBack')}
        onClose={Sb.action('onClose')}
      />
    ))
  Sb.storiesOf('Wallets/SendForm', module)
    .addDecorator(
      provider({
        action: () => {},
        bannerBackground: 'Announcements' as const,
        offerAdvancedSendForm: AdvancedBanner.senderBanner,
        text: '',
      })
    )
    .add('Send with Advanced Send Banner', () => (
      <SendRequestForm
        isRequest={false}
        isAdvanced={false}
        onBack={Sb.action('onBack')}
        onClose={Sb.action('onClose')}
      />
    ))
}

export default load
