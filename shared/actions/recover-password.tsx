import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as RecoverPasswordGen from '../actions/recover-password-gen'
import * as ProvisionGen from '../actions/provision-gen'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Constants from '../constants/provision'
import * as Container from '../util/container'
import {RPCError} from '../util/errors'

const chooseDevice = (
  params: RPCTypes.MessageTypes['keybase.1.provisionUi.chooseDevice']['inParam'],
  response: {
    result: (id: string) => void
    error: (res: {code: RPCTypes.StatusCode; desc: string}) => void
  }
) => {
  return Saga.callUntyped(function*() {
    const devices = (params.devices || []).map(d => Constants.rpcDeviceToDevice(d))
    yield Saga.put(RecoverPasswordGen.createDisplayDeviceSelect({devices}))

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
  return Saga.all([
    Saga.put(
      RecoverPasswordGen.createShowExplainDevice({
        name: params.name,
        type: params.kind,
      })
    ),
    Saga.put(
      RouteTreeGen.createNavigateAppend({
        path: ['recoverPasswordExplainDevice'],
        replace: true,
      })
    ),
  ])
}

const promptReset = (
  params: RPCTypes.MessageTypes['keybase.1.loginUi.promptResetAccount']['inParam'],
  response: {
    result: (reset: boolean) => void
  }
) => {
  if (params.prompt.t === RPCTypes.ResetPromptType.enterResetPw) {
    return Saga.callUntyped(function*() {
      yield Saga.put(
        RouteTreeGen.createNavigateAppend({
          path: ['recoverPasswordResetPassword'],
          replace: true,
        })
      )
      const action: RecoverPasswordGen.SubmitResetPromptPayload = yield Saga.take(
        RecoverPasswordGen.submitResetPrompt
      )
      response.result(action.payload.action)

      // todo new screen?
      yield Saga.put(RouteTreeGen.createNavigateUp())
    })
  }

  return Saga.callUntyped(function*() {
    yield Saga.put(
      RouteTreeGen.createNavigateAppend({
        path: ['recoverPasswordPromptReset'],
        replace: true,
      })
    )
    const action: RecoverPasswordGen.SubmitResetPromptPayload = yield Saga.take(
      RecoverPasswordGen.submitResetPrompt
    )
    response.result(action.payload.action)
    if (action.payload.action) {
      // todo new screen?
      yield Saga.put(RouteTreeGen.createNavigateUp())
    } else {
      yield Saga.put(RecoverPasswordGen.createRestartRecovery())
    }
  })
}

const inputPaperKey = (
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
            error: params.pinentry.retryLabel,
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
        yield Saga.put(RecoverPasswordGen.createSetPasswordError({error: params.pinentry.retryLabel}))
      }
      yield Saga.put(RouteTreeGen.createNavigateAppend({path: ['recoverPasswordSetPassword']}))
      const action: RecoverPasswordGen.SubmitPasswordPayload = yield Saga.take([
        RecoverPasswordGen.submitPassword,
      ])
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
  try {
    yield RPCTypes.loginRecoverPassphraseRpcSaga({
      customResponseIncomingCallMap: {
        'keybase.1.loginUi.promptResetAccount': promptReset,
        'keybase.1.provisionUi.chooseDevice': chooseDevice,
        'keybase.1.secretUi.getPassphrase': inputPaperKey,
      },
      incomingCallMap: {
        'keybase.1.loginUi.explainDeviceRecovery': explainDevice,
      },
      params: {
        username: action.payload.username,
      },
    })
  } catch (e) {
    logger.warn('RPC returned error: ' + e)
    if (
      !(
        e instanceof RPCError &&
        (e.code === RPCTypes.StatusCode.sccanceled || e.code === RPCTypes.StatusCode.scinputcanceled)
      )
    ) {
      yield Saga.put(
        RecoverPasswordGen.createDisplayError({
          error: e.toString(),
        })
      )
    }
  }
}

const displayDeviceSelect = () => {
  return RouteTreeGen.createNavigateAppend({
    path: ['recoverPasswordDeviceSelector'],
  })
}

const displayError = () => {
  return RouteTreeGen.createNavigateAppend({
    path: ['recoverPasswordError'],
    replace: true,
  })
}

const restartRecovery = (state: Container.TypedState) => {
  return [
    RecoverPasswordGen.createStartRecoverPassword({
      username: state.recoverPassword.username,
    }),
    RouteTreeGen.createNavigateUp(),
  ]
}

function* recoverPasswordSaga() {
  yield* Saga.chainGenerator<RecoverPasswordGen.StartRecoverPasswordPayload>(
    RecoverPasswordGen.startRecoverPassword,
    startRecoverPassword,
    'startRecoverPassword'
  )
  yield* Saga.chainAction2(RecoverPasswordGen.displayDeviceSelect, displayDeviceSelect, 'displayDeviceSelect')
  yield* Saga.chainAction2(RecoverPasswordGen.displayError, displayError, 'displayError')
  yield* Saga.chainAction2(RecoverPasswordGen.restartRecovery, restartRecovery, 'restartRecovery')
}

export default recoverPasswordSaga
