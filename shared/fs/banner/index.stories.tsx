import React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Sb from '../../stories/storybook'
import ResetBanner from './reset-banner'
import SystemFileManagerIntegrationBanner from './system-file-manager-integration-banner'
import KextPermissionPopup from './system-file-manager-integration-banner/kext-permission-popup'
import {commonProvider} from '../common/index.stories'
import ConflictBanner from './conflict-banner-container'
import PublicReminder from './public-reminder'

const resetBannerCommon = {
  onOpenWithoutResetUsers: Sb.action('onOpenWithoutResetUsers'),
  onReAddToTeam: (username: string) => Sb.action(`onReAddToTeam(${username})`),
  onViewProfile: (username: string) => Sb.action(`onViewProfile(${username})`),
}

const commonSystemFileManagerIntegrationBannerSettings = {
  isLoading: false,
  loaded: true,
  sfmiBannerDismissed: false,
  spaceAvailableNotificationThreshold: 0,
  syncOnCellular: false,
}

const commonSystemFileManagerIntegrationBannerProps = {
  onDisable: Sb.action('onDisable'),
  onDismiss: Sb.action('onDismiss'),
  onEnable: Sb.action('onEnable'),
  settings: commonSystemFileManagerIntegrationBannerSettings,
}

export const bannerProvider = {
  ConflictBanner: (p: any) => ({
    conflictState: (p.storyProps && p.storyProps.conflictState) || Constants.tlfNormalViewWithNoConflict,
    onFeedback: Sb.action('onFeedback'),
    onFinishResolving: Sb.action('onFinishResolving'),
    onGoToSamePathInDifferentTlf: Sb.action('onGoToSamePathInDifferentTlf'),
    onHelp: Sb.action('onHelp'),
    onStartResolving: Sb.action('onStartResolving'),
    tlfPath: '/keybase/private/alice,bob',
  }),
  PublicReminder: ({path}: {path: Types.Path}) => {
    const parsedPath = Constants.parsePath(path)
    return {
      hidden: false,
      onClose: Sb.action('close'),
      onLoadNonBannerFolder: () => {},
      show: parsedPath.kind === Types.PathKind.GroupTlf && parsedPath.tlfType === Types.TlfType.Public,
      url: parsedPath.kind === Types.PathKind.GroupTlf ? `https://keybase.pub/${parsedPath.tlfName}` : '',
    }
  },
  ResetBanner: ({path}: {path: Types.Path}) => ({
    ...resetBannerCommon,
    isUserReset: Types.pathToString(path) === '/keybase/private/me,reset',
    resetParticipants: Types.pathToString(path).includes('reset') ? ['foo'] : [],
  }),
  SystemFileManagerIntegrationBanner: ({alwaysShow}: any) => ({
    alwaysShow,
    ...commonSystemFileManagerIntegrationBannerProps,
    driverStatus: Constants.driverStatusUnknown,
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
    .add('ResetBanner - multiple resets', () => (
      <ResetBanner resetParticipants={['reset1', 'reset3']} {...resetBannerCommon} />
    ))
    .add('ResetBanner - single reset', () => (
      <ResetBanner resetParticipants={['reset1']} {...resetBannerCommon} />
    ))
    .add('Public Reminder Banner', () => (
      <PublicReminder path={Types.stringToPath('/keybase/public/jakob223,songgao')} />
    ))
    .add('SystemFileManagerIntegrationBanner - disabled', () => (
      <SystemFileManagerIntegrationBanner
        {...commonSystemFileManagerIntegrationBannerProps}
        driverStatus={Constants.emptyDriverStatusDisabled}
      />
    ))
    .add('SystemFileManagerIntegrationBanner - disabled, enabling', () => (
      <SystemFileManagerIntegrationBanner
        {...commonSystemFileManagerIntegrationBannerProps}
        driverStatus={{...Constants.emptyDriverStatusDisabled, isEnabling: true}}
      />
    ))
    .add('SystemFileManagerIntegrationBanner - enabled, new', () => (
      <SystemFileManagerIntegrationBanner
        {...commonSystemFileManagerIntegrationBannerProps}
        driverStatus={{...Constants.emptyDriverStatusEnabled}}
      />
    ))
    .add('SystemFileManagerIntegrationBanner - enabled, disabling', () => (
      <SystemFileManagerIntegrationBanner
        {...commonSystemFileManagerIntegrationBannerProps}
        driverStatus={{...Constants.emptyDriverStatusEnabled, isDisabling: true}}
      />
    ))
    .add('SystemFileManagerIntegrationBanner - enabled, dokanOutdated', () => (
      <SystemFileManagerIntegrationBanner
        {...commonSystemFileManagerIntegrationBannerProps}
        driverStatus={{
          ...Constants.emptyDriverStatusEnabled,
          dokanOutdated: true,
          dokanUninstallExecPath: 'c:\\blah',
        }}
      />
    ))
    .add('SystemFileManagerIntegrationBanner - enabled, dokanOutdated, diabling', () => (
      <SystemFileManagerIntegrationBanner
        {...commonSystemFileManagerIntegrationBannerProps}
        driverStatus={{
          ...Constants.emptyDriverStatusEnabled,
          dokanOutdated: true,
          dokanUninstallExecPath: 'c:\\blah',
          isDisabling: true,
        }}
      />
    ))
    .add('SystemFileManagerIntegrationBanner - kext permissiion popup', () => (
      <KextPermissionPopup
        driverStatus={{...Constants.emptyDriverStatusDisabled, isEnabling: false}}
        onCancel={Sb.action('onCancel')}
        openSecurityPrefs={Sb.action('openSecurityPrefs')}
      />
    ))
    .add('SystemFileManagerIntegrationBanner - kext permissiion popup - enabling', () => (
      <KextPermissionPopup
        driverStatus={{...Constants.emptyDriverStatusDisabled, isEnabling: true}}
        onCancel={Sb.action('onCancel')}
        openSecurityPrefs={Sb.action('openSecurityPrefs')}
      />
    ))
    .add('Conflict Resolution - in conflict, not stuck', () => (
      <ConflictBanner
        path={Types.stringToPath('/keybase/team/keybasefriends')}
        {...Sb.propOverridesForStory({
          conflictState: Constants.makeConflictStateNormalView({resolvingConflict: true}),
        })}
      />
    ))
    .add('Conflict Resolution - in conflict, stuck', () => (
      <ConflictBanner
        path={Types.stringToPath('/keybase/team/keybasefriends')}
        {...Sb.propOverridesForStory({
          conflictState: Constants.makeConflictStateNormalView({
            resolvingConflict: true,
            stuckInConflict: true,
          }),
        })}
      />
    ))
    .add('Conflict Resolution - in resolution, server view, one conflict', () => (
      <ConflictBanner
        path={Types.stringToPath('/keybase/team/keybasefriends')}
        {...Sb.propOverridesForStory({
          conflictState: Constants.makeConflictStateNormalView({
            localViewTlfPaths: [Types.stringToPath('/keybase/team/keybasefriends (conflict #1)')],
          }),
        })}
      />
    ))
    .add('Conflict Resolution - in resolution, server view, one conflict, stuck again', () => (
      <ConflictBanner
        path={Types.stringToPath('/keybase/team/keybasefriends')}
        {...Sb.propOverridesForStory({
          conflictState: Constants.makeConflictStateNormalView({
            localViewTlfPaths: [Types.stringToPath('/keybase/team/keybasefriends (conflict #1)')],
            resolvingConflict: true,
            stuckInConflict: true,
          }),
        })}
      />
    ))
    .add('Conflict Resolution - in resolution, server view, multiple conflicts', () => (
      <ConflictBanner
        path={Types.stringToPath('/keybase/team/keybasefriends')}
        {...Sb.propOverridesForStory({
          conflictState: Constants.makeConflictStateNormalView({
            localViewTlfPaths: [
              Types.stringToPath('/keybase/team/keybasefriends (conflict #1)'),
              Types.stringToPath('/keybase/team/keybasefriends (conflict #2)'),
              Types.stringToPath('/keybase/team/keybasefriends (conflict #3)'),
            ],
          }),
        })}
      />
    ))
    .add('Conflict Resolution - finishing', () => (
      <ConflictBanner
        path={Types.stringToPath('/keybase/team/keybasefriends (conflict #1)')}
        {...Sb.propOverridesForStory({
          conflictState: Constants.makeConflictStateManualResolvingLocalView({
            normalViewTlfPath: Types.stringToPath('/keybsae/team/keybasefriends'),
          }),
        })}
      />
    ))
}
