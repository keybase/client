import * as Z from '../util/zustand'
import logger from '../logger'
import * as RPCTypes from './types/rpc-gen'
import * as EngineGen from '../actions/engine-gen-gen'

type Store = {}
const initialStore: Store = {}

type State = Store & {
  dispatch: {
    connected: () => void
    disconnected: () => void
    incomingCall: (action: EngineGen.Actions) => void
    resetState: 'default'
  }
}

export const useState = Z.createZustand<State>(() => {
  const dispatch: State['dispatch'] = {
    connected: () => {
      const f = async () => {
        const PinentryConstants = await import('./pinentry')
        const TrackerConstants = await import('./tracker2')
        const ConfigConstants = await import('./config')
        const UnlockFolderConstants = await import('./unlock-folders')
        const PeopleConstants = await import('./people')
        const NotifConstants = await import('./notifications')
        const ChatConstants = await import('./chat2')
        PinentryConstants.useState.getState().dispatch.onEngineConnected()
        TrackerConstants.useState.getState().dispatch.onEngineConnected()
        ConfigConstants.useConfigState.getState().dispatch.onEngineConnected()
        UnlockFolderConstants.useState.getState().dispatch.onEngineConnected()
        PeopleConstants.useState.getState().dispatch.onEngineConnected()
        NotifConstants.useState.getState().dispatch.onEngineConnected()
        ChatConstants.useState.getState().dispatch.onEngineConnected()
      }
      Z.ignorePromise(f())
    },
    disconnected: () => {
      const f = async () => {
        const ConfigConstants = await import('./config')
        ConfigConstants.useConfigState.getState().dispatch.onEngineDisonnected()
      }
      Z.ignorePromise(f())
    },
    incomingCall: action => {
      const f = async () => {
        const BotsConstants = await import('./bots')
        const ChatConstants = await import('./chat2')
        const ConfigConstants = await import('./config')
        const DLConstants = await import('./deeplinks')
        const FSConstants = await import('./fs')
        const NotifConstants = await import('./notifications')
        const PeopleConstants = await import('./people')
        const PinConstants = await import('./pinentry')
        const SettingsConstants = await import('./settings')
        const SignupConstants = await import('./signup')
        const TeamsConstants = await import('./teams')
        const TrackerConstants = await import('./tracker2')
        const UsersConstants = await import('./users')
        const UnlockConstants = await import('./unlock-folders')
        switch (action.type) {
          case EngineGen.chat1NotifyChatChatTypingUpdate: // fallthrough
          case EngineGen.chat1ChatUiChatInboxFailed: // fallthrough
          case EngineGen.chat1NotifyChatChatSetConvRetention: // fallthrough
          case EngineGen.chat1NotifyChatChatSetConvSettings: // fallthrough
          case EngineGen.chat1NotifyChatChatAttachmentUploadProgress:
            ChatConstants.useState.getState().dispatch.onEngineIncoming(action)
            break

          case EngineGen.chat1NotifyChatChatWelcomeMessageLoaded: // fallthrough
          case EngineGen.keybase1NotifyTeamTeamChangedByID: // fallthrough
          case EngineGen.keybase1NotifyTeamTeamDeleted: // fallthrough
          case EngineGen.keybase1NotifyTeamTeamExit: // fallthrough
          case EngineGen.keybase1NotifyTeamTeamMetadataUpdate: // fallthrough
          case EngineGen.keybase1NotifyTeamTeamRoleMapChanged: // fallthrough
          case EngineGen.keybase1NotifyTeamTeamTreeMembershipsDone: // fallthrough
          case EngineGen.keybase1NotifyTeamTeamTreeMembershipsPartial:
            TeamsConstants.useState.getState().dispatch.onEngineIncoming(action)
            break

          case EngineGen.keybase1NotifyUsersPasswordChanged: {
            const randomPW = action.payload.params.state === RPCTypes.PassphraseState.random
            SettingsConstants.usePasswordState.getState().dispatch.notifyUsersPasswordChanged(randomPW)
            break
          }
          case EngineGen.keybase1NotifyPhoneNumberPhoneNumbersChanged: {
            const {list} = action.payload.params
            SettingsConstants.usePhoneState
              .getState()
              .dispatch.notifyPhoneNumberPhoneNumbersChanged(list ?? undefined)
            break
          }
          case EngineGen.keybase1NotifyEmailAddressEmailsChanged: {
            const list = action.payload.params.list ?? []
            SettingsConstants.useEmailState.getState().dispatch.notifyEmailAddressEmailsChanged(list)
            break
          }

          case EngineGen.keybase1NotifyFSFSOverallSyncStatusChanged: // fallthrough
          case EngineGen.keybase1NotifyFSFSSubscriptionNotify: // fallthrough
          case EngineGen.keybase1NotifyFSFSSubscriptionNotifyPath:
            FSConstants.useState.getState().dispatch.onEngineIncoming(action)
            break

          case EngineGen.keybase1Identify3UiIdentify3Result: // fallthrough
          case EngineGen.keybase1Identify3UiIdentify3ShowTracker: // fallthrough
          case EngineGen.keybase1Identify3UiIdentify3Summary: // fallthrough
          case EngineGen.keybase1Identify3UiIdentify3UpdateRow: // fallthrough
          case EngineGen.keybase1Identify3UiIdentify3UpdateUserCard: // fallthrough
          case EngineGen.keybase1Identify3UiIdentify3UserReset: // fallthrough
          case EngineGen.keybase1NotifyTrackingNotifyUserBlocked: // fallthrough
          case EngineGen.keybase1NotifyUsersUserChanged:
            TrackerConstants.useState.getState().dispatch.onEngineIncoming(action)
            break

          case EngineGen.keybase1GregorUIPushState: // fallthrough
          case EngineGen.keybase1NotifyRuntimeStatsRuntimeStatsUpdate: // fallthrough
          case EngineGen.keybase1NotifyServiceHTTPSrvInfoUpdate: // fallthrough
          case EngineGen.keybase1NotifySessionLoggedIn: // fallthrough
          case EngineGen.keybase1NotifySessionLoggedOut: // fallthrough
          case EngineGen.keybase1NotifyTeamAvatarUpdated: // fallthrough
          case EngineGen.keybase1NotifyTrackingTrackingInfo: // fallthrough
          case EngineGen.keybase1ReachabilityReachabilityChanged:
            ConfigConstants.useConfigState.getState().dispatch.onEngineIncoming(action)
            break

          case EngineGen.keybase1NotifyUsersIdentifyUpdate:
            UsersConstants.useState.getState().dispatch.onEngineIncoming(action)
            break

          case EngineGen.keybase1HomeUIHomeUIRefresh:
            PeopleConstants.useState.getState().dispatch.onEngineIncoming(action)
            break

          case EngineGen.keybase1NotifyServiceHandleKeybaseLink:
            DLConstants.useState.getState().dispatch.onEngineIncoming(action)
            break

          case EngineGen.keybase1NotifyAuditRootAuditError: // fallthrough
          case EngineGen.keybase1NotifyAuditBoxAuditError: // fallthrough
          case EngineGen.keybase1NotifyBadgesBadgeState:
            NotifConstants.useState.getState().dispatch.onEngineIncoming(action)
            break

          case EngineGen.keybase1SecretUiGetPassphrase:
            PinConstants.useState.getState().dispatch.onEngineIncoming(action)
            break

          case EngineGen.keybase1LogsendPrepareLogsend: // fallthrough
          case EngineGen.keybase1NotifyAppExit: // fallthrough
          case EngineGen.keybase1NotifyFSFSActivity: // fallthrough
          case EngineGen.keybase1NotifyPGPPgpKeyInSecretStoreFile: // fallthrough
          case EngineGen.keybase1NotifyServiceShutdown: // fallthrough
          case EngineGen.keybase1NotifySessionClientOutOfDate: // fallthrough
            ConfigConstants.useConfigState.getState().dispatch.dynamic.onEngineIncomingDesktop?.(action)
            break

          case EngineGen.chat1ChatUiChatClearWatch: // fallthrough
          case EngineGen.chat1ChatUiChatWatchPosition: // fallthrough
          case EngineGen.chat1ChatUiTriggerContactSync: // fallthrough
            ConfigConstants.useConfigState.getState().dispatch.dynamic.onEngineIncomingNative?.(action)
            break

          case EngineGen.keybase1NotifyFeaturedBotsFeaturedBotsUpdate:
            BotsConstants.useState.getState().dispatch.botsUpdate(action)
            break

          case EngineGen.keybase1LogUiLog: // fallthrough
            ConfigConstants.useConfigState.getState().dispatch.dynamic.onEngineIncomingNative?.(action)
            ConfigConstants.useConfigState.getState().dispatch.dynamic.onEngineIncomingDesktop?.(action)
            break

          case EngineGen.keybase1RekeyUIRefresh: //fallthrough
          case EngineGen.keybase1RekeyUIDelegateRekeyUI:
            UnlockConstants.useState.getState().dispatch.onEngineIncoming(action)
            break
          case EngineGen.keybase1NotifyTrackingTrackingChanged: // fallthrough
            TrackerConstants.useState.getState().dispatch.onEngineIncoming(action)
            ConfigConstants.useConfigState.getState().dispatch.onEngineIncoming(action)
            break

          case EngineGen.keybase1NotifyEmailAddressEmailAddressVerified:
            logger.info('email verified')
            SettingsConstants.useEmailState
              .getState()
              .dispatch.notifyEmailVerified(action.payload.params.emailAddress)
            PeopleConstants.useState.getState().dispatch.onEngineIncoming(action)
            SignupConstants.useState.getState().dispatch.onEngineIncoming(action)
            break
          default:
        }
      }
      Z.ignorePromise(f())
    },
    resetState: 'default',
  }
  return {
    ...initialStore,
    dispatch,
  }
})
