import * as AutoresetGen from './autoreset-gen'
import * as Constants from '../constants/recover-password'
import * as Container from '../util/container'
import * as ProvisionConstants from '../constants/provision'
import * as ProvisionGen from './provision-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RecoverPasswordGen from './recover-password-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as Saga from '../util/saga'
import HiddenString from '../util/hidden-string'
import {RPCError} from '../util/errors'

const chooseDevice = (replaceRoute: boolean) => (
  params: RPCTypes.MessageTypes['keybase.1.loginUi.chooseDeviceToRecoverWith']['inParam'],
  response: {
    result: (id: string) => void
    error: (res: {code: RPCTypes.StatusCode; desc: string}) => void
  }
) => {
  return Saga.callUntyped(function*() {
    const devices = (params.devices || []).map(d => ProvisionConstants.rpcDeviceToDevice(d))
    yield Saga.put(
      RecoverPasswordGen.createDisplayDeviceSelect({
        devices,
        replaceRoute,
      })
    )

    const action:
      | RecoverPasswordGen.SubmitDeviceSelectPayload
      | RecoverPasswordGen.AbortDeviceSelectPayload = yield Saga.take([
      RecoverPasswordGen.submitDeviceSelect,
      RecoverPasswordGen.abortDeviceSelect,
    ])
    if (action.type === RecoverPasswordGen.submitDeviceSelect) {
      response.result(action.payload.id)
    } else {
      response.error({
        code: RPCTypes.StatusCode.scinputcanceled,
        desc: 'Input canceled',
      })
      yield Saga.put(RouteTreeGen.createNavigateUp())
    }
  })
}

const explainDevice = (
  params: RPCTypes.MessageTypes['keybase.1.loginUi.explainDeviceRecovery']['inParam']
) => {
  return Saga.put(
    RecoverPasswordGen.createShowExplainDevice({
      name: params.name,
      type: params.kind,
    })
  )
}

const showExplainDevice = () => {
  return RouteTreeGen.createNavigateAppend({
    path: ['recoverPasswordExplainDevice'],
    replace: true,
  })
}

// This same RPC is called at the beginning and end of the 7-day wait by the service.
const promptReset = (
  params: RPCTypes.MessageTypes['keybase.1.loginUi.promptResetAccount']['inParam'],
  response: {
    result: (res: RPCTypes.ResetPromptResponse) => void
  }
) => {
  return Saga.callUntyped(function*() {
    if (params.prompt.t == RPCTypes.ResetPromptType.enterResetPw) {
      yield Saga.put(RecoverPasswordGen.createPromptResetPassword())

      const action: RecoverPasswordGen.SubmitResetPasswordPayload = yield Saga.take(
        RecoverPasswordGen.submitResetPassword
      )
      response.result(action.payload.action)
      yield Saga.put(RecoverPasswordGen.createCompleteResetPassword())
    } else {
      yield Saga.put(AutoresetGen.createStartAccountReset({skipPassword: true}))
      response.result(RPCTypes.ResetPromptResponse.nothing)
    }
  })
}

const getPaperKeyOrPw = (
  params: RPCTypes.MessageTypes['keybase.1.secretUi.getPassphrase']['inParam'],
  response: {
    result: (res: {passphrase: string; storeSecret: boolean}) => void
    error: (res: {code: RPCTypes.StatusCode; desc: string}) => void
  }
) => {
  return Saga.callUntyped(function*() {
    if (params.pinentry.type === RPCTypes.PassphraseType.paperKey) {
      if (params.pinentry.retryLabel) {
        yield Saga.put(
          RecoverPasswordGen.createSetPaperKeyError({
            error: new HiddenString(params.pinentry.retryLabel),
          })
        )
      }
      yield Saga.put(
        RouteTreeGen.createNavigateAppend({
          path: ['recoverPasswordPaperKey'],
          replace: true,
        })
      )
      const action:
        | RecoverPasswordGen.SubmitPaperKeyPayload
        | RecoverPasswordGen.AbortPaperKeyPayload = yield Saga.take([
        RecoverPasswordGen.submitPaperKey,
        RecoverPasswordGen.abortPaperKey,
      ])

      if (action.type === RecoverPasswordGen.submitPaperKey) {
        response.result({
          passphrase: action.payload.paperKey.stringValue(),
          storeSecret: false,
        })
      } else {
        response.error({
          code: RPCTypes.StatusCode.scinputcanceled,
          desc: 'Input canceled',
        })
        yield Saga.put(RecoverPasswordGen.createRestartRecovery())
      }
    } else {
      if (params.pinentry.retryLabel) {
        yield Saga.put(
          RecoverPasswordGen.createSetPasswordError({error: new HiddenString(params.pinentry.retryLabel)})
        )
      } else {
        // TODO maybe wait for loggedIn, for now the service promises to send this after login.
        yield Saga.put(RouteTreeGen.createNavigateAppend({path: ['recoverPasswordSetPassword']}))
      }
      const action: RecoverPasswordGen.SubmitPasswordPayload = yield Saga.take([
        RecoverPasswordGen.submitPassword,
      ])
      response.result({passphrase: action.payload.password.stringValue(), storeSecret: true})
    }
  })
}

function* startRecoverPassword(
  _: any,
  action: RecoverPasswordGen.StartRecoverPasswordPayload,
  logger: Saga.SagaLogger
) {
  if (action.payload.abortProvisioning) {
    yield Saga.put(ProvisionGen.createCancelProvision())
  }
  let hadError = false
  try {
    yield RPCTypes.loginRecoverPassphraseRpcSaga({
      customResponseIncomingCallMap: {
        'keybase.1.loginUi.chooseDeviceToRecoverWith': chooseDevice(!!action.payload.replaceRoute),
        'keybase.1.loginUi.promptResetAccount': promptReset,
        'keybase.1.secretUi.getPassphrase': getPaperKeyOrPw,
      },
      incomingCallMap: {
        'keybase.1.loginUi.explainDeviceRecovery': explainDevice,
      },
      params: {
        username: action.payload.username,
      },
      waitingKey: Constants.waitingKey,
    })
  } catch (e) {
    hadError = true
    logger.warn('RPC returned error: ' + e.message)
    if (
      !(
        e instanceof RPCError &&
        (e.code === RPCTypes.StatusCode.sccanceled || e.code === RPCTypes.StatusCode.scinputcanceled)
      )
    ) {
      yield Saga.put(
        RecoverPasswordGen.createDisplayError({
          error: new HiddenString(e.message),
        })
      )
    }
  }
  logger.info(`finished ${hadError ? 'with error' : 'without error'}`)
  if (!hadError) {
    yield Saga.put(RouteTreeGen.createClearModals())
  }
}

const displayDeviceSelect = (action: RecoverPasswordGen.DisplayDeviceSelectPayload) => {
  return RouteTreeGen.createNavigateAppend({
    path: ['recoverPasswordDeviceSelector'],
    replace: !!action.payload.replaceRoute,
  })
}

const displayError = (state: Container.TypedState) => {
  return RouteTreeGen.createNavigateAppend({
    path: [state.config.loggedIn ? 'recoverPasswordErrorModal' : 'recoverPasswordError'],
    replace: true,
  })
}

const restartRecovery = (state: Container.TypedState) => {
  return RecoverPasswordGen.createStartRecoverPassword({
    replaceRoute: true,
    username: state.recoverPassword.username,
  })
}

const promptResetPassword = () => {
  return RouteTreeGen.createNavigateAppend({
    path: ['recoverPasswordPromptResetPassword'],
  })
}

const completeResetPassword = () => {
  return RouteTreeGen.createNavigateUp()
}

function* recoverPasswordSaga() {
  yield* Saga.chainGenerator<RecoverPasswordGen.StartRecoverPasswordPayload>(
    RecoverPasswordGen.startRecoverPassword,
    startRecoverPassword
  )
  yield* Saga.chainAction(RecoverPasswordGen.displayDeviceSelect, displayDeviceSelect)
  yield* Saga.chainAction2(RecoverPasswordGen.showExplainDevice, showExplainDevice)
  yield* Saga.chainAction2(RecoverPasswordGen.displayError, displayError)
  yield* Saga.chainAction2(RecoverPasswordGen.restartRecovery, restartRecovery)
  yield* Saga.chainAction2(RecoverPasswordGen.promptResetPassword, promptResetPassword)
  yield* Saga.chainAction2(RecoverPasswordGen.completeResetPassword, completeResetPassword)
}

export default recoverPasswordSaga
