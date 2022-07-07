import * as AutoresetGen from './autoreset-gen'
import * as Constants from '../constants/recover-password'
import * as Container from '../util/container'
import * as ProvisionConstants from '../constants/provision'
import * as ProvisionGen from './provision-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RecoverPasswordGen from './recover-password-gen'
import * as RouteTreeGen from './route-tree-gen'
import HiddenString from '../util/hidden-string'
import {RPCError} from '../util/errors'
import logger from '../logger'

const showExplainDevice = () =>
  RouteTreeGen.createNavigateAppend({
    path: ['recoverPasswordExplainDevice'],
    replace: true,
  })

const startRecoverPassword = async (
  _s: unknown,
  action: RecoverPasswordGen.StartRecoverPasswordPayload,
  listenerApi: Container.ListenerApi
) => {
  if (action.payload.abortProvisioning) {
    listenerApi.dispatch(ProvisionGen.createCancelProvision())
  }
  let hadError = false
  try {
    await RPCTypes.loginRecoverPassphraseRpcListener(
      {
        customResponseIncomingCallMap: {
          'keybase.1.loginUi.chooseDeviceToRecoverWith': async (params, response) => {
            const replaceRoute = !!action.payload.replaceRoute
            const devices = (params.devices || []).map(d => ProvisionConstants.rpcDeviceToDevice(d))
            listenerApi.dispatch(RecoverPasswordGen.createDisplayDeviceSelect({devices, replaceRoute}))

            const [act] = await listenerApi.take<
              RecoverPasswordGen.SubmitDeviceSelectPayload | RecoverPasswordGen.AbortDeviceSelectPayload
            >(
              action =>
                action.type === RecoverPasswordGen.submitDeviceSelect ||
                action.type === RecoverPasswordGen.abortDeviceSelect
            )
            if (act.type === RecoverPasswordGen.submitDeviceSelect) {
              response.result(act.payload.id)
            } else {
              response.error({code: RPCTypes.StatusCode.scinputcanceled, desc: 'Input canceled'})
              listenerApi.dispatch(RouteTreeGen.createNavigateUp())
            }
          },
          // This same RPC is called at the beginning and end of the 7-day wait by the service.
          'keybase.1.loginUi.promptResetAccount': async (params, response) => {
            if (params.prompt.t == RPCTypes.ResetPromptType.enterResetPw) {
              listenerApi.dispatch(RecoverPasswordGen.createPromptResetPassword())

              const [action] = await listenerApi.take<RecoverPasswordGen.SubmitResetPasswordPayload>(
                action => action.type === RecoverPasswordGen.submitResetPassword
              )
              response.result(action.payload.action)
              listenerApi.dispatch(RecoverPasswordGen.createCompleteResetPassword())
            } else {
              listenerApi.dispatch(AutoresetGen.createStartAccountReset({skipPassword: true}))
              response.result(RPCTypes.ResetPromptResponse.nothing)
            }
          },
          'keybase.1.secretUi.getPassphrase': async (params, response) => {
            if (params.pinentry.type === RPCTypes.PassphraseType.paperKey) {
              if (params.pinentry.retryLabel) {
                listenerApi.dispatch(
                  RecoverPasswordGen.createSetPaperKeyError({
                    error: new HiddenString(params.pinentry.retryLabel),
                  })
                )
              }
              listenerApi.dispatch(
                RouteTreeGen.createNavigateAppend({path: ['recoverPasswordPaperKey'], replace: true})
              )
              const [action] = await listenerApi.take<
                RecoverPasswordGen.SubmitPaperKeyPayload | RecoverPasswordGen.AbortPaperKeyPayload
              >(
                action =>
                  action.type === RecoverPasswordGen.submitPaperKey ||
                  action.type === RecoverPasswordGen.abortPaperKey
              )

              if (action.type === RecoverPasswordGen.submitPaperKey) {
                response.result({passphrase: action.payload.paperKey.stringValue(), storeSecret: false})
              } else {
                response.error({code: RPCTypes.StatusCode.scinputcanceled, desc: 'Input canceled'})
                listenerApi.dispatch(RecoverPasswordGen.createRestartRecovery())
              }
            } else {
              if (params.pinentry.retryLabel) {
                listenerApi.dispatch(
                  RecoverPasswordGen.createSetPasswordError({
                    error: new HiddenString(params.pinentry.retryLabel),
                  })
                )
              } else {
                // TODO maybe wait for loggedIn, for now the service promises to send this after login.
                listenerApi.dispatch(
                  RouteTreeGen.createNavigateAppend({path: ['recoverPasswordSetPassword']})
                )
              }
              const [action] = await listenerApi.take<RecoverPasswordGen.SubmitPasswordPayload>(
                action => action.type === RecoverPasswordGen.submitPassword
              )
              response.result({passphrase: action.payload.password.stringValue(), storeSecret: true})
            }
          },
        },
        incomingCallMap: {
          'keybase.1.loginUi.explainDeviceRecovery': params =>
            RecoverPasswordGen.createShowExplainDevice({name: params.name, type: params.kind}),
        },
        params: {username: action.payload.username},
        waitingKey: Constants.waitingKey,
      },
      listenerApi
    )
  } catch (error) {
    if (!(error instanceof RPCError)) {
      return
    }
    hadError = true
    logger.warn('RPC returned error: ' + error.message)
    if (
      !(
        error instanceof RPCError &&
        (error.code === RPCTypes.StatusCode.sccanceled || error.code === RPCTypes.StatusCode.scinputcanceled)
      )
    ) {
      listenerApi.dispatch(
        RecoverPasswordGen.createDisplayError({
          error: new HiddenString(error.message),
        })
      )
    }
  }
  logger.info(`finished ${hadError ? 'with error' : 'without error'}`)
  if (!hadError) {
    listenerApi.dispatch(RouteTreeGen.createClearModals())
  }
}

const displayDeviceSelect = (_: unknown, action: RecoverPasswordGen.DisplayDeviceSelectPayload) =>
  RouteTreeGen.createNavigateAppend({
    path: ['recoverPasswordDeviceSelector'],
    replace: !!action.payload.replaceRoute,
  })

const displayError = (state: Container.TypedState) =>
  RouteTreeGen.createNavigateAppend({
    path: [state.config.loggedIn ? 'recoverPasswordErrorModal' : 'recoverPasswordError'],
    replace: true,
  })

const restartRecovery = (state: Container.TypedState) =>
  RecoverPasswordGen.createStartRecoverPassword({
    replaceRoute: true,
    username: state.recoverPassword.username,
  })

const promptResetPassword = () =>
  RouteTreeGen.createNavigateAppend({
    path: ['recoverPasswordPromptResetPassword'],
  })

const completeResetPassword = () => RouteTreeGen.createNavigateUp()

const initRecoverPassword = () => {
  Container.listenAction(RecoverPasswordGen.startRecoverPassword, startRecoverPassword)
  Container.listenAction(RecoverPasswordGen.displayDeviceSelect, displayDeviceSelect)
  Container.listenAction(RecoverPasswordGen.showExplainDevice, showExplainDevice)
  Container.listenAction(RecoverPasswordGen.displayError, displayError)
  Container.listenAction(RecoverPasswordGen.restartRecovery, restartRecovery)
  Container.listenAction(RecoverPasswordGen.promptResetPassword, promptResetPassword)
  Container.listenAction(RecoverPasswordGen.completeResetPassword, completeResetPassword)
}

export default initRecoverPassword
