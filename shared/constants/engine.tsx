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
        const TeamsConstants = await import('./teams')
        const RouterConstants = await import('./router2')
        const SettingsConstants = await import('./settings')
        const FSConstants = await import('./fs')
        switch (action.type) {
          case EngineGen.keybase1NotifyTeamTeamMetadataUpdate:
            TeamsConstants.useState.getState().dispatch.eagerLoadTeams()
            TeamsConstants.useState.getState().dispatch.resetTeamMetaStale()
            break
          case EngineGen.chat1NotifyChatChatWelcomeMessageLoaded: {
            const {teamID, message} = action.payload.params
            TeamsConstants.useState.getState().dispatch.loadedWelcomeMessage(teamID, message)
            break
          }
          case EngineGen.keybase1NotifyTeamTeamTreeMembershipsPartial: {
            const {membership} = action.payload.params
            TeamsConstants.useState.getState().dispatch.notifyTreeMembershipsPartial(membership)
            break
          }
          case EngineGen.keybase1NotifyTeamTeamTreeMembershipsDone: {
            const {result} = action.payload.params
            TeamsConstants.useState.getState().dispatch.notifyTreeMembershipsDone(result)
            break
          }
          case EngineGen.keybase1NotifyTeamTeamRoleMapChanged: {
            const {newVersion} = action.payload.params
            TeamsConstants.useState.getState().dispatch.notifyTeamTeamRoleMapChanged(newVersion)
            break
          }
          case EngineGen.keybase1NotifyTeamTeamChangedByID:
            TeamsConstants.useState.getState().dispatch.teamChangedByID(action.payload.params)
            break

          case EngineGen.keybase1NotifyTeamTeamDeleted:
            // likely wrong?
            if (RouterConstants.getTab()) {
              RouterConstants.useState.getState().dispatch.navUpToScreen('teamsRoot')
            }
            break
          case EngineGen.keybase1NotifyTeamTeamExit:
            if (RouterConstants.getTab()) {
              RouterConstants.useState.getState().dispatch.navUpToScreen('teamsRoot')
            }
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
          case EngineGen.keybase1NotifyEmailAddressEmailAddressVerified:
            logger.info('email verified')
            SettingsConstants.useEmailState
              .getState()
              .dispatch.notifyEmailVerified(action.payload.params.emailAddress)
            break
          case EngineGen.keybase1NotifyFSFSOverallSyncStatusChanged:
            FSConstants.useState.getState().dispatch.syncStatusChanged(action.payload.params.status)
            break
          case EngineGen.keybase1NotifyFSFSSubscriptionNotifyPath: {
            const {clientID, path, topics} = action.payload.params
            FSConstants.useState.getState().dispatch.onPathChange(clientID, path, topics ?? [])
            break
          }
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
