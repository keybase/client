// @flow
import React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Sb from '../../stories/storybook'
import ResetBanner from './reset-banner'
import SystemFileManagerIntegrationBanner from './system-file-manager-integration-banner'
import KextPermissionPopup from './system-file-manager-integration-banner/kext-permission-popup'
import {commonProvider} from '../common/index.stories'
import ConflictBanner from './conflict-banner-container'

const resetBannerCommon = {
  onOpenWithoutResetUsers: Sb.action('onOpenWithoutResetUsers'),
  onReAddToTeam: (username: string) => Sb.action(`onReAddToTeam(${username})`),
  onViewProfile: (username: string) => Sb.action(`onViewProfile(${username})`),
}

const commonSystemFileManagerIntegrationBannerActions = {
  onDisable: Sb.action('onDisable'),
  onDismiss: Sb.action('onDismiss'),
  onEnable: Sb.action('onEnable'),
}

export const bannerProvider = {
  ConflictBanner: ({conflictState}: {conflictState: Types.ConflictState}) => ({
    conflictState: conflictState,
    isUnmergedView: false,
    onFeedback: Sb.action('onFeedback'),
    onFinishResolving: Sb.action('onFinishResolving'),
    onHelp: Sb.action('onHelp'),
    onSeeOtherView: Sb.action('onSeeOtherView'),
    onStartResolving: Sb.action('onStartResolving'),
  }),
  ResetBanner: ({path}: {path: Types.Path}) => ({
    ...resetBannerCommon,
    isUserReset: Types.pathToString(path) === '/keybase/private/me,reset',
    resetParticipants: Types.pathToString(path).includes('reset') ? ['foo'] : [],
  }),
  SystemFileManagerIntegrationBanner: ({alwaysShow}: any) => ({
    alwaysShow,
    ...commonSystemFileManagerIntegrationBannerActions,
    driverStatus: Constants.makeDriverStatusUnknown(),
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
    .add('SystemFileManagerIntegrationBanner - disabled', () => (
      <SystemFileManagerIntegrationBanner
        {...commonSystemFileManagerIntegrationBannerActions}
        driverStatus={Constants.makeDriverStatusDisabled()}
      />
    ))
    .add('SystemFileManagerIntegrationBanner - disabled, enabling', () => (
      <SystemFileManagerIntegrationBanner
        {...commonSystemFileManagerIntegrationBannerActions}
        driverStatus={Constants.makeDriverStatusDisabled({isEnabling: true})}
      />
    ))
    .add('SystemFileManagerIntegrationBanner - enabled, new', () => (
      <SystemFileManagerIntegrationBanner
        {...commonSystemFileManagerIntegrationBannerActions}
        driverStatus={Constants.makeDriverStatusEnabled({isNew: true})}
      />
    ))
    .add('SystemFileManagerIntegrationBanner - enabled, disabling', () => (
      <SystemFileManagerIntegrationBanner
        {...commonSystemFileManagerIntegrationBannerActions}
        driverStatus={Constants.makeDriverStatusEnabled({isDisabling: true})}
      />
    ))
    .add('SystemFileManagerIntegrationBanner - enabled, dokanOutdated', () => (
      <SystemFileManagerIntegrationBanner
        {...commonSystemFileManagerIntegrationBannerActions}
        driverStatus={Constants.makeDriverStatusEnabled({
          dokanOutdated: true,
          dokanUninstallExecPath: 'c:\\blah',
        })}
      />
    ))
    .add('SystemFileManagerIntegrationBanner - enabled, dokanOutdated, diabling', () => (
      <SystemFileManagerIntegrationBanner
        {...commonSystemFileManagerIntegrationBannerActions}
        driverStatus={Constants.makeDriverStatusEnabled({
          dokanOutdated: true,
          dokanUninstallExecPath: 'c:\\blah',
          isDisabling: true,
        })}
      />
    ))
    .add('SystemFileManagerIntegrationBanner - kext permissiion popup', () => (
      <KextPermissionPopup
        driverStatus={Constants.makeDriverStatusDisabled({isEnabling: false})}
        onCancel={Sb.action('onCancel')}
        openSecurityPrefs={Sb.action('openSecurityPrefs')}
      />
    ))
    .add('SystemFileManagerIntegrationBanner - kext permissiion popup - enabling', () => (
      <KextPermissionPopup
        driverStatus={Constants.makeDriverStatusDisabled({isEnabling: true})}
        onCancel={Sb.action('onCancel')}
        openSecurityPrefs={Sb.action('openSecurityPrefs')}
      />
    ))
    .add('Conflict Resolution - in conflict, not stuck', () => (
      <ConflictBanner
        path={Types.stringToPath('/keybase/team/keybasefriends')}
        conflictState="in-conflict-not-stuck"
      />
    ))
    .add('Conflict Resolution - in conflict, stuck', () => (
      <ConflictBanner
        path={Types.stringToPath('/keybase/team/keybasefriends')}
        conflictState="in-conflict-stuck"
      />
    ))
    .add('Conflict Resolution - in resolution, server view', () => (
      <ConflictBanner
        path={Types.stringToPath('/keybase/team/keybasefriends')}
        conflictState="in-manual-resolution"
      />
    ))
    .add('Conflict Resolution - finishing', () => (
      <ConflictBanner path={Types.stringToPath('/keybase/team/keybasefriends')} conflictState="finishing" />
    ))
}
