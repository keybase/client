// @flow
import React from 'react'
import * as Types from '../../constants/types/fs'
import * as Sb from '../../stories/storybook'
import ResetBanner from './reset-banner'
import FileUIBanner from './fileui-banner'

const resetBannerCommon = {
  onOpenWithoutResetUsers: Sb.action('onOpenWithoutResetUsers'),
  onReAddToTeam: Sb.action('onReAddToTeam'),
  onViewProfile: Sb.action('onViewProfile'),
}

const fileUIBannerCommon = {
  getFuseStatus: Sb.action('getFuseStatus'),
  onDismiss: Sb.action('onDismiss'),
  onInstall: Sb.action('onInstall'),
  onUninstall: Sb.action('onUninstall'),
}

export const bannerProvider = {
  FileUIBanner: () => ({
    ...fileUIBannerCommon,
    inProgress: false,
    kbfsEnabled: true,
    path: Types.stringToPath('/keybase'),
    showBanner: false,
  }),
  ResetBanner: ({path}: {path: Types.Path}) => ({
    ...resetBannerCommon,
    isUserReset: Types.pathToString(path) === '/keybase/private/me,reset',
    resetParticipants: Types.pathToString(path).includes('reset') ? ['foo'] : [],
  }),
}

const provider = Sb.createPropProviderWithCommon({
  ...bannerProvider,
})

export default () => {
  Sb.storiesOf('Files/Banners', module)
    .addDecorator(provider)
    .addDecorator(Sb.scrollViewDecorator)
    .add('ResetBanner - other', () => (
      <ResetBanner isUserReset={false} resetParticipants={['reset1', 'reset3']} {...resetBannerCommon} />
    ))
    .add('FileUIBanner - fuse', () => (
      <FileUIBanner
        inProgress={false}
        kbfsEnabled={false}
        path={Types.stringToPath('/keybase')}
        showBanner={true}
        {...fileUIBannerCommon}
      />
    ))
    .add('FileUIBanner - outdated', () => (
      <FileUIBanner
        kbfsOutdated={true}
        inProgress={false}
        kbfsEnabled={false}
        path={Types.stringToPath('/keybase')}
        showBanner={true}
        {...fileUIBannerCommon}
      />
    ))
    .add('FileUIBanner - inProgress', () => (
      <FileUIBanner
        kbfsOutdated={false}
        inProgress={true}
        kbfsEnabled={false}
        path={Types.stringToPath('/keybase')}
        showBanner={true}
        {...fileUIBannerCommon}
      />
    ))
}
