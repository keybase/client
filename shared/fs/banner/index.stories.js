// @flow
import React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Sb from '../../stories/storybook'
import ResetBanner from './reset-banner'
import FileUIBanner from './fileui-banner'
import KextPermissionPopup from './fileui-banner/kext-permission-popup'
import {commonProvider} from '../common/index.stories'

const resetBannerCommon = {
  onOpenWithoutResetUsers: Sb.action('onOpenWithoutResetUsers'),
  onReAddToTeam: (username: string) => Sb.action(`onReAddToTeam(${username})`),
  onViewProfile: (username: string) => Sb.action(`onViewProfile(${username})`),
}

const commonFileUIBannerActions = {
  onDisable: Sb.action('onDisable'),
  onDismiss: Sb.action('onDismiss'),
  onEnable: Sb.action('onEnable'),
}

export const bannerProvider = {
  FileUIBanner: ({alwaysShow}: any) => ({
    alwaysShow,
    ...commonFileUIBannerActions,
    driverStatus: Constants.makeDriverStatusUnknown(),
  }),
  ResetBanner: ({path}: {path: Types.Path}) => ({
    ...resetBannerCommon,
    isUserReset: Types.pathToString(path) === '/keybase/private/me,reset',
    resetParticipants: Types.pathToString(path).includes('reset') ? ['foo'] : [],
  }),
}

const provider = Sb.createPropProviderWithCommon({
  ...commonProvider,
  ...bannerProvider,
})

export default () => {
  Sb.storiesOf('Files/Banners', module)
    .addDecorator(provider)
    .addDecorator(Sb.scrollViewDecorator)
    .add('ResetBanner - other', () => (
      <ResetBanner isUserReset={false} resetParticipants={['reset1', 'reset3']} {...resetBannerCommon} />
    ))
    .add('FileUIBanner - disabled', () => (
      <FileUIBanner {...commonFileUIBannerActions} driverStatus={Constants.makeDriverStatusDisabled()} />
    ))
    .add('FileUIBanner - disabled, enabling', () => (
      <FileUIBanner
        {...commonFileUIBannerActions}
        driverStatus={Constants.makeDriverStatusDisabled({isEnabling: true})}
      />
    ))
    .add('FileUIBanner - enabled, new', () => (
      <FileUIBanner
        {...commonFileUIBannerActions}
        driverStatus={Constants.makeDriverStatusEnabled({isNew: true})}
      />
    ))
    .add('FileUIBanner - enabled, disabling', () => (
      <FileUIBanner
        {...commonFileUIBannerActions}
        driverStatus={Constants.makeDriverStatusEnabled({isDisabling: true})}
      />
    ))
    .add('FileUIBanner - enabled, dokanOutdated', () => (
      <FileUIBanner
        {...commonFileUIBannerActions}
        driverStatus={Constants.makeDriverStatusEnabled({dokanOutdated: 'can-disable'})}
      />
    ))
    .add('FileUIBanner - enabled, dokanOutdated, diabling', () => (
      <FileUIBanner
        {...commonFileUIBannerActions}
        driverStatus={Constants.makeDriverStatusEnabled({dokanOutdated: 'can-disable', isDisabling: true})}
      />
    ))
    .add('FileUIBanner - kext permissiion popup', () => (
      <KextPermissionPopup
        onCancel={Sb.action('onCancel')}
        openSecurityPrefs={Sb.action('openSecurityPrefs')}
      />
    ))
}
