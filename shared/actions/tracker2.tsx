import * as Constants from '../constants/tracker2'
import * as ConfigConstants from '../constants/config'
import * as Container from '../util/container'
import * as EngineGen from './engine-gen-gen'
import * as Tracker2Gen from './tracker2-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import logger from '../logger'

const rpcResultToStatus = (result: RPCTypes.Identify3ResultType) => {
  switch (result) {
    case RPCTypes.Identify3ResultType.ok:
      return 'valid'
    case RPCTypes.Identify3ResultType.broken:
      return 'broken'
    case RPCTypes.Identify3ResultType.needsUpgrade:
      return 'needsUpgrade'
    case RPCTypes.Identify3ResultType.canceled:
      return 'error'
  }
}

const initTracker = () => {
  // only refresh if we have tracked them before
  Container.listenAction(EngineGen.keybase1NotifyTrackingTrackingChanged, (_, action) => {
    const {username} = action.payload.params
    if (Constants.useState.getState().usernameToDetails.get(username)) {
      Constants.useState.getState().dispatch.load({
        assertion: username,
        fromDaemon: false,
        guiID: Constants.generateGUIID(),
        ignoreCache: true,
        inTracker: false,
        reason: '',
      })
    }
  })
  Container.listenAction(EngineGen.keybase1Identify3UiIdentify3Result, (_, action) => {
    const {guiID, result} = action.payload.params
    Constants.useState.getState().dispatch.updateResult(guiID, rpcResultToStatus(result))
  })
  Container.listenAction(EngineGen.keybase1Identify3UiIdentify3ShowTracker, (_, action) => {
    const {assertion, forceDisplay = false, guiID, reason} = action.payload.params
    Constants.useState.getState().dispatch.load({
      assertion,
      forceDisplay,
      fromDaemon: true,
      guiID,
      ignoreCache: false,
      inTracker: true,
      reason: reason.reason,
    })
  })
  Container.listenAction(EngineGen.connected, async () => {
    try {
      await RPCTypes.delegateUiCtlRegisterIdentify3UIRpcPromise()
      logger.info('Registered identify ui')
    } catch (error) {
      logger.warn('error in registering identify ui: ', error)
    }
  })

  // if we mutated somehow reload ourselves and reget the suggestions
  Container.listenAction(EngineGen.keybase1NotifyUsersUserChanged, (_, action) => {
    if (ConfigConstants.useCurrentUserState.getState().uid !== action.payload.params.uid) {
      return
    }
    Constants.useState.getState().dispatch.load({
      assertion: ConfigConstants.useCurrentUserState.getState().username,
      forceDisplay: false,
      fromDaemon: false,
      guiID: Constants.generateGUIID(),
      ignoreCache: false,
      inTracker: false,
      reason: '',
    })
    Constants.useState.getState().dispatch.getProofSuggestions()
  })

  // This allows the server to send us a notification to *remove* (not add)
  // arbitrary followers from arbitrary tracker2 results, so we can hide
  // blocked users from follower lists.
  Container.listenAction(EngineGen.keybase1NotifyTrackingNotifyUserBlocked, (_, action) => {
    Constants.useState.getState().dispatch.notifyUserBlocked(action.payload.params.b)
  })
  Container.listenAction(EngineGen.keybase1Identify3UiIdentify3UpdateRow, (_, action) => {
    const {row} = action.payload.params
    Constants.useState.getState().dispatch.notifyRow(row)
  })
  Container.listenAction(EngineGen.keybase1Identify3UiIdentify3UserReset, (_, action) => {
    const {guiID} = action.payload.params
    Constants.useState.getState().dispatch.notifyReset(guiID)
  })
  Container.listenAction(EngineGen.keybase1Identify3UiIdentify3UpdateUserCard, (_, action) => {
    const {guiID, card} = action.payload.params
    Constants.useState.getState().dispatch.notifyCard(guiID, card)
  })
  Container.listenAction(EngineGen.keybase1Identify3UiIdentify3Summary, (_, action) => {
    const {summary} = action.payload.params
    Constants.useState.getState().dispatch.notifySummary(summary)
  })
  // only used by remote tracker, TODO this will change
  Container.listenAction(Tracker2Gen.changeFollow, (_, a) => {
    Constants.useState.getState().dispatch.changeFollow(a.payload.guiID, a.payload.follow)
  })
  Container.listenAction(Tracker2Gen.ignore, (_, a) => {
    Constants.useState.getState().dispatch.ignore(a.payload.guiID)
  })
  Container.listenAction(Tracker2Gen.closeTracker, (_, a) => {
    Constants.useState.getState().dispatch.closeTracker(a.payload.guiID)
  })
  Container.listenAction(Tracker2Gen.load, (_, a) => {
    Constants.useState.getState().dispatch.load(a.payload)
  })
}

export default initTracker
