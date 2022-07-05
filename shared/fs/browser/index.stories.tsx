import React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Sb from '../../stories/storybook'
import DestinationPicker from './destination-picker'
import Browser from '.'
import Root from './root'
import * as Kb from '../../common-adapters'
import {isMobile} from '../../constants/platform'
import {rowsProvider} from './rows/index.stories'
import {commonProvider} from '../common/index.stories'
import {topBarProvider} from '../top-bar/index.stories'
import {footerProvider} from '../footer/index.stories'
import {bannerProvider} from '../banner/index.stories'
import {produce} from 'immer'

const _provider = {
  ...rowsProvider,
  ...commonProvider,
  ...topBarProvider,
  ...footerProvider,
  ...bannerProvider,

  // for DestinationPicker
  NavHeaderTitle: ({path}: {path: Types.Path}) => ({
    onOpenPath: Sb.action('onOpenPath'),
    path,
  }),
}

const storeCommon = Sb.createStoreWithCommon()
const storeShowingSfmi = produce(storeCommon, draftStoreCommon => {
  draftStoreCommon.fs.sfmi.driverStatus = {...Constants.emptyDriverStatusEnabled}
})
const storeOthersReset = produce(storeCommon, draftStore => {
  draftStore.fs.tlfs.private.set(
    'others,reset',
    Constants.makeTlf({
      name: 'others,reset',
      resetParticipants: ['foo'],
    })
  )
})

const provider = Sb.createPropProviderWithCommon(_provider)
// @ts-ignore
const providerShowingSfmi = Sb.createPropProviderWithCommon({
  ..._provider,
  ...storeShowingSfmi,
})
// @ts-ignore
const providerOthersReset = Sb.createPropProviderWithCommon({
  ..._provider,
  ...storeOthersReset,
})

export default () => {
  Sb.storiesOf('Files/Browser', module)
    .addDecorator(provider)
    .add('Root', () => (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <Root />
      </Kb.Box2>
    ))
    .add('normal', () => (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <Browser
          path={Types.stringToPath('/keybase/private/foo')}
          resetBannerType={Types.ResetBannerNoOthersType.None}
          offlineUnsynced={false}
          writable={true}
        />
      </Kb.Box2>
    ))
    .add('public', () => (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <Browser
          path={Types.stringToPath('/keybase/public/foo')}
          resetBannerType={Types.ResetBannerNoOthersType.None}
          offlineUnsynced={false}
          writable={true}
        />
      </Kb.Box2>
    ))
    .add('I am reset', () => (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <Browser
          path={Types.stringToPath('/keybase/private/me,reset')}
          resetBannerType={Types.ResetBannerNoOthersType.Self}
          offlineUnsynced={false}
          writable={true}
        />
      </Kb.Box2>
    ))
  Sb.storiesOf('Files/Browser', module)
    .addDecorator(providerOthersReset)
    .add('others reset', () => (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <Browser
          path={Types.stringToPath('/keybase/private/others,reset')}
          resetBannerType={1}
          offlineUnsynced={false}
          writable={true}
        />
      </Kb.Box2>
    ))
    .add('offline and not synced', () => (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <Browser
          path={Types.stringToPath('/keybase/private/others,reset')}
          resetBannerType={Types.ResetBannerNoOthersType.None}
          offlineUnsynced={true}
          writable={true}
        />
      </Kb.Box2>
    ))
  Sb.storiesOf('Files/Browser', module)
    .addDecorator(providerShowingSfmi)
    .add('Root - showing SFMI banner', () => (
      <Kb.Box2 direction="horizontal" fullWidth={true} fullHeight={true}>
        <Root />
      </Kb.Box2>
    ))
  Sb.storiesOf('Files', module)
    .addDecorator(provider)
    .add('DestinationPicker', () => (
      <DestinationPicker
        parentPath={Types.stringToPath('/keybase/private/meatball,songgao,xinyuzhao/yo')}
        onCancel={Sb.action('onCancel')}
        targetName="Secret treat spot blasjeiofjawiefjksadjflaj long name blahblah"
        index={0}
        isShare={false}
        onCopyHere={Sb.action('onCopyHere')}
        onMoveHere={Sb.action('onMoveHere')}
        onNewFolder={Sb.action('onNewFolder')}
        onBackUp={isMobile ? Sb.action('onBackUp') : null}
      />
    ))
}
