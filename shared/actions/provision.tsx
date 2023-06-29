// import * as Constants from '../constants/provision'
// import * as ConfigConstants from '../constants/config'
// import * as WaitingConstants from '../constants/waiting'
// import * as RouteTreeGen from './route-tree-gen'
// import * as ProvisionGen from './provision-gen'
// import * as RPCTypes from '../constants/types/rpc-gen'
// import * as Tabs from '../constants/tabs'
// import logger from '../logger'
// import HiddenString from '../util/hidden-string'
// import {RPCError} from '../util/errors'
// import * as Container from '../util/container'
// import {devicesTab as settingsDevicesTab} from '../constants/settings'

// const devicesRoot = Container.isMobile
//   ? ([Tabs.settingsTab, settingsDevicesTab] as const)
//   : ([Tabs.devicesTab, 'devicesRoot'] as const)

// type ValidCallback =
//   | 'keybase.1.gpgUi.selectKey'
//   | 'keybase.1.loginUi.displayPrimaryPaperKey'
//   | 'keybase.1.loginUi.getEmailOrUsername'
//   | 'keybase.1.provisionUi.DisplayAndPromptSecret'
//   | 'keybase.1.provisionUi.DisplaySecretExchanged'
//   | 'keybase.1.provisionUi.PromptNewDeviceName'
//   | 'keybase.1.provisionUi.ProvisioneeSuccess'
//   | 'keybase.1.provisionUi.ProvisionerSuccess'
//   | 'keybase.1.provisionUi.chooseDevice'
//   | 'keybase.1.provisionUi.chooseDeviceType'
//   | 'keybase.1.provisionUi.chooseGPGMethod'
//   | 'keybase.1.provisionUi.switchToGPGSignOK'
//   | 'keybase.1.secretUi.getPassphrase'

// const ignoreCallback = () => {}

// type CustomParam<T extends ValidCallback> = RPCTypes.MessageTypes[T]['inParam']
// type CustomResp<T extends ValidCallback> = {
//   error: RPCTypes.IncomingErrorCallback
//   result: (res: RPCTypes.MessageTypes[T]['outParam']) => void
// }

// const makeProvisioningManager = (
//   addingANewDevice: boolean,
//   listenerApi: Container.ListenerApi | undefined
// ): ProvisioningManager => new ProvisioningManager(addingANewDevice, listenerApi, 'ONLY_CALL_THIS_FROM_HELPER')

/**
 * We are starting the provisioning process. This is largely controlled by the daemon. We get a callback to show various
 * screens and we stash the result object so we can show the screen. When the submit on that screen is done we find the stashedReponse and respond and wait
 */
// const startProvisioning = async (
//   state: Container.TypedState,
//   _a: unknown,
//   listenerApi: Container.ListenerApi
// ) => {
//   const {clear} = WaitingConstants.useWaitingState.getState().dispatch
//   clear(Constants.waitingKey)
//   const manager = makeProvisioningManager(false, listenerApi)
//   try {
//     const username = state.provision.username
//     if (!username) {
//       return
//     }

//     await RPCTypes.loginLoginRpcListener(
//       {
//         customResponseIncomingCallMap: ProvisioningManager.getSingleton().getCustomResponseIncomingCallMap(),
//         incomingCallMap: ProvisioningManager.getSingleton().getIncomingCallMap(),
//         params: {
//           clientType: RPCTypes.ClientType.guiMain,
//           deviceName: '',
//           deviceType: Container.isMobile ? 'mobile' : 'desktop',
//           doUserSwitch: true,
//           paperKey: '',
//           username: username,
//         },
//         waitingKey: Constants.waitingKey,
//       },
//       listenerApi
//     )
//     ProvisioningManager.getSingleton().setDone('provision call done w/ success')
//   } catch (finalError) {
//     if (!(finalError instanceof RPCError)) {
//       return
//     }
//     manager.setDone(
//       'startProvisioning call done w/ error ' + (finalError ? finalError.message : ' unknown error')
//     )

//     if (ProvisioningManager.getSingleton() !== manager) {
//       // Another provisioning session has started while this one was active.
//       // This is not desired and is an indication of a problem somewhere else.
//       logger.error(
//         `Provision.startProvisioning error, and ProvisioningManager has changed: ${finalError.message}`
//       )
//       return
//     }

//     if (Constants.errorCausedByUsCanceling(finalError) && manager.isCanceled()) {
//       // After cancelling the RPC we are going to get "input canceled" error.
//       return
//     }

//     // If it's a non-existent username or invalid, allow the opportunity to
//     // correct it right there on the page.
//     switch (finalError.code) {
//       case RPCTypes.StatusCode.scnotfound:
//       case RPCTypes.StatusCode.scbadusername:
//         listenerApi.dispatch(ProvisionGen.createShowInlineError({inlineError: finalError}))
//         break
//       default:
//         listenerApi.dispatch(ProvisionGen.createShowFinalErrorPage({finalError, fromDeviceAdd: false}))
//         break
//     }
//   } finally {
//     clear(Constants.waitingKey)
//     listenerApi.dispatch(ProvisionGen.createProvisionDone())
//   }
// }

// addNewDevice: otherDeviceType => {
//   set(s => {
//     s.error = ''
//     s.codePageOtherDevice.type = otherDeviceType
//   })
//   const f = async () => {
//     // Make a new handler each time.
//     WaitingConstants.useWaitingState.getState().dispatch.clear(waitingKey)
//     const manager = new ProvisioningManager(true)
//     try {
//       await RPCTypes.deviceDeviceAddRpcListener(
//         {
//           customResponseIncomingCallMap:
//             ProvisioningManager.getSingleton().getCustomResponseIncomingCallMap(),
//           incomingCallMap: ProvisioningManager.getSingleton().getIncomingCallMap(),
//           params: undefined,
//           waitingKey: Constants.waitingKey,
//         },
//         listenerApi
//       )
//       ProvisioningManager.getSingleton().setDone('add device success')
//       // Now refresh and nav back
//       listenerApi.dispatch(RouteTreeGen.createNavigateAppend({path: devicesRoot}))
//       listenerApi.dispatch(RouteTreeGen.createClearModals())
//     } catch (finalError) {
//       if (!(finalError instanceof RPCError)) {
//         return
//       }
//       manager.setDone(
//         'addNewDevice call done w/ error ' + (finalError ? finalError.message : ' unknown error')
//       )

//       if (ProvisioningManager.getSingleton() !== manager) {
//         // Another provisioning session has started while this one was active.
//         // This is not desired and is an indication of a problem somewhere else.
//         logger.error(
//           `Provision.addNewDevice error, and ProvisioningManager has changed: ${finalError.message}`
//         )
//         return
//       }

//       if (Constants.errorCausedByUsCanceling(finalError) && manager.isCanceled()) {
//         // After cancelling the RPC we are going to get "input canceled" error.
//         return
//       }

//       listenerApi.dispatch(ProvisionGen.createShowFinalErrorPage({finalError, fromDeviceAdd: true}))
//       logger.error(`Provision -> Add device error: ${finalError.message}`)
//     } finally {
//       const {clear} = WaitingConstants.useWaitingState.getState().dispatch
//       clear(Constants.waitingKey)
//       listenerApi.dispatch(ProvisionGen.createProvisionDone())
//     }
//   }
//   Z.ignorePromise(f())
// },
// We delegate these actions to the manager
// const submitDeviceSelect = () => ProvisioningManager.getSingleton().submitDeviceSelect()
// const submitDeviceName = (state: Container.TypedState) =>
//   ProvisioningManager.getSingleton().submitDeviceName(state)
// const submitTextCode = (state: Container.TypedState) =>
//   ProvisioningManager.getSingleton().submitTextCode(state)
// const submitGPGMethod = (state: Container.TypedState, action: ProvisionGen.SubmitGPGMethodPayload) =>
//   ProvisioningManager.getSingleton().submitGPGMethod(state, action)
// const submitGPGSignOK = (_: unknown, action: ProvisionGen.SubmitGPGSignOKPayload) =>
//   ProvisioningManager.getSingleton().submitGPGSignOK(action)
// const submitPasswordOrPaperkey = (
//   state: Container.TypedState,
//   action: ProvisionGen.SubmitPasswordPayload | ProvisionGen.SubmitPaperkeyPayload
// ) => ProvisioningManager.getSingleton().submitPasswordOrPaperkey(state, action)
// const maybeCancelProvision = () => {
//   ProvisioningManager.getSingleton().maybeCancelProvision()
// }

// const showNewDeviceNamePage = (state: Container.TypedState) =>
//   !state.provision.error.stringValue() &&
//   RouteTreeGen.createNavigateAppend({
//     path: ['setPublicName'],
//     replace: true,
//   })

// const showCodePage = (state: Container.TypedState) =>
//   !state.provision.error.stringValue() && ProvisioningManager.getSingleton().showCodePage()

// const showGPGPage = (state: Container.TypedState) =>
//   !state.provision.error.stringValue() &&
//   RouteTreeGen.createNavigateAppend({path: ['gpgSign'], replace: true})

// const showPasswordPage = (state: Container.TypedState) =>
//   !state.provision.error.stringValue() &&
//   RouteTreeGen.createNavigateAppend({path: ['password'], replace: true})

// const showPaperkeyPage = (state: Container.TypedState) =>
//   !state.provision.error.stringValue() &&
//   RouteTreeGen.createNavigateAppend({path: ['paperkey'], replace: true})

// const showFinalErrorPage = (_: unknown, action: ProvisionGen.ShowFinalErrorPagePayload) => {
//   const parentPath = action.payload.fromDeviceAdd ? devicesRoot : (['login'] as const)
//   const replace = !action.payload.fromDeviceAdd
//   const path = ['error'] as const
//   return [
//     ...(action.payload.fromDeviceAdd ? [RouteTreeGen.createClearModals()] : []),
//     RouteTreeGen.createNavigateAppend({path: [...parentPath, ...path], replace}),
//   ]
// }

// const showUsernameEmailPage = async (_: unknown, action: ProvisionGen.StartProvisionPayload) => {
//   // If we're logged in, we're coming from the user switcher; log out first to prevent the service from getting out of sync with the GUI about our logged-in-ness
//   if (ConfigConstants.useConfigState.getState().loggedIn) {
//     await RPCTypes.loginLogoutRpcPromise(
//       {force: false, keepSecrets: true},
//       ConfigConstants.loginAsOtherUserWaitingKey
//     )
//   }
//   return RouteTreeGen.createNavigateAppend({
//     path: [{props: {fromReset: action.payload.fromReset}, selected: 'username'}],
//   })
// }

// const decodeForgotUsernameError = (error: RPCError) => {
//   switch (error.code) {
//     case RPCTypes.StatusCode.scnotfound:
//       return "We couldn't find an account with that email address. Try again?"
//     case RPCTypes.StatusCode.scinputerror:
//       return "That doesn't look like a valid email address. Try again?"
//     default:
//       return error.desc
//   }
// }

// const forgotUsername = async (_: unknown, action: ProvisionGen.ForgotUsernamePayload) => {
//   if (action.payload.email) {
//     try {
//       await RPCTypes.accountRecoverUsernameWithEmailRpcPromise(
//         {email: action.payload.email},
//         Constants.forgotUsernameWaitingKey
//       )
//       return ProvisionGen.createForgotUsernameResult({result: 'success'})
//     } catch (error) {
//       if (!(error instanceof RPCError)) {
//         return
//       }
//       return ProvisionGen.createForgotUsernameResult({
//         result: decodeForgotUsernameError(error),
//       })
//     }
//   }
//   if (action.payload.phone) {
//     try {
//       await RPCTypes.accountRecoverUsernameWithPhoneRpcPromise(
//         {phone: action.payload.phone},
//         Constants.forgotUsernameWaitingKey
//       )
//       return ProvisionGen.createForgotUsernameResult({result: 'success'})
//     } catch (error) {
//       if (!(error instanceof RPCError)) {
//         return
//       }
//       return ProvisionGen.createForgotUsernameResult({
//         result: decodeForgotUsernameError(error),
//       })
//     }
//   }

//   return null
// }

// const backToDeviceList = async (
//   _: Container.TypedState,
//   action: ProvisionGen.BackToDeviceListPayload,
//   listenerApi: Container.ListenerApi
// ) => {
//   const cancelled = ProvisioningManager.getSingleton().maybeCancelProvision()
//   if (cancelled) {
//     // must wait for previous session to close
//     await listenerApi.take(action => action.type === ProvisionGen.provisionDone)
//   }
//   listenerApi.dispatch(ProvisionGen.createSubmitUsername({username: action.payload.username}))
// }

const initProvision = () => {
  // Always ensure we have one live
  // makeProvisioningManager(false, undefined)
  // Start provision
  // Container.listenAction(ProvisionGen.submitUsername, startProvisioning)
  // Submits
  // Container.listenAction(ProvisionGen.submitDeviceSelect, submitDeviceSelect)
  // Container.listenAction(ProvisionGen.submitDeviceName, submitDeviceName)
  // Container.listenAction(ProvisionGen.submitTextCode, submitTextCode)
  // Container.listenAction(ProvisionGen.submitGPGMethod, submitGPGMethod)
  // Container.listenAction(ProvisionGen.submitGPGSignOK, submitGPGSignOK)
  // Container.listenAction([ProvisionGen.submitPassword, ProvisionGen.submitPaperkey], submitPasswordOrPaperkey)
  // // Screens
  // Container.listenAction(ProvisionGen.startProvision, showUsernameEmailPage)
  // Container.listenAction(ProvisionGen.showNewDeviceNamePage, showNewDeviceNamePage)
  // Container.listenAction(ProvisionGen.showCodePage, showCodePage)
  // Container.listenAction(ProvisionGen.showGPGPage, showGPGPage)
  // Container.listenAction(ProvisionGen.showPasswordPage, showPasswordPage)
  // Container.listenAction(ProvisionGen.showPaperkeyPage, showPaperkeyPage)
  // Container.listenAction(ProvisionGen.showFinalErrorPage, showFinalErrorPage)
  // Container.listenAction(ProvisionGen.forgotUsername, forgotUsername)
  // Container.listenAction(ProvisionGen.cancelProvision, maybeCancelProvision)
  // Container.listenAction(ProvisionGen.backToDeviceList, backToDeviceList)
}

export default initProvision
