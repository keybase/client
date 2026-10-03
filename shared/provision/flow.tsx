import * as T from '@/constants/types'
import isEqual from 'lodash/isEqual'
import {invalidPasswordErrorString} from '@/constants/config'
import {type Device, type ProvisionRouteError} from '@/constants/provision'
import {clearModals, navigateAppend} from '@/constants/router'
import {rpcDeviceToDevice} from '@/constants/rpc-utils'
import {waitingKeyConfigLoginAsOther, waitingKeyProvision} from '@/constants/strings'
import {ignorePromise} from '@/constants/utils'
import {openDialog, type Dialog, type DialogEvent, type Prompt} from '@/engine/dialog'
import logger from '@/logger'
import {useConfigState} from '@/stores/config'
import {useDaemonState} from '@/stores/daemon'
import {isCancelled, RPCError} from '@/util/errors'

// The steps the user has already answered, replayed in order when the login RPC restarts.
type Step =
  | {type: 'username'}
  | {type: 'passphrase'}
  | {type: 'deviceName'}
  | {type: 'chooseDevice'; devices: Array<Device>}
  | {type: 'promptSecret'}

// Do NOT change this. These values are used by the daemon also so this way we can ignore it when they do it / when we do
const errorCausedByUsCanceling = (e?: RPCError) => {
  const desc = e?.desc
  return desc === 'Input canceled' || desc === 'kex canceled by caller'
}

const makeDevice = (): Device => ({
  deviceNumberOfType: 0,
  id: T.Devices.stringToDeviceID(''),
  name: '',
  type: 'mobile',
})

const chooseDevicePrompt = 'keybase.1.provisionUi.chooseDevice'
const deviceNamePrompt = 'keybase.1.provisionUi.PromptNewDeviceName'
const passphrasePrompt = 'keybase.1.secretUi.getPassphrase'
const secretPrompt = 'keybase.1.provisionUi.DisplayAndPromptSecret'
const secretExchanged = 'keybase.1.provisionUi.DisplaySecretExchanged'
// Login never takes these paths, so they are refused
const refusedPrompts = [
  'keybase.1.gpgUi.selectKey',
  'keybase.1.loginUi.getEmailOrUsername',
  'keybase.1.provisionUi.chooseGPGMethod',
  'keybase.1.provisionUi.switchToGPGSignOK',
] as const
const successNotices = ['keybase.1.provisionUi.ProvisioneeSuccess', 'keybase.1.provisionUi.ProvisionerSuccess'] as const
const loginPrompts = [chooseDevicePrompt, deviceNamePrompt, passphrasePrompt, secretPrompt, ...refusedPrompts] as const
const loginNotices = ['keybase.1.loginUi.displayPrimaryPaperKey', secretExchanged, ...successNotices] as const

// Go works on the secret exchange while codePage's secret prompt stays open, so the waiting key stays
// on from an exchanged notice until the next prompt (a retried code, a password), or the RPC's end
const makeExchangeHold = (dialog: {holdServerWork: () => () => void}) => {
  let release: (() => void) | undefined
  return {
    hold: () => {
      release ??= dialog.holdServerWork()
    },
    release: () => {
      release?.()
      release = undefined
    },
  }
}

// Clears the provision screens and shows why the run failed
const showProvisionError = (error: RPCError, replace: boolean, username?: string) => {
  clearModals()
  navigateAppend(
    {
      name: 'error',
      params: {
        error: {
          code: error.code,
          desc: error.desc,
          details: error.details,
          fields: error.fields as ReadonlyArray<{key?: string; value?: string}> | undefined,
          message: error.message,
        } satisfies ProvisionRouteError,
        username,
      },
    },
    replace
  )
}

// A prompt the run could not show ends it. The exception goes to the log; the user sees this.
const showFailedError = new RPCError('Something went wrong. Please try again.', T.RPCGen.StatusCode.scgeneric)
const endOnShowFailure = (dialog: {dispose: () => void}, method: string, error: unknown) => {
  logger.error(`Provision: showing ${method} failed`, error)
  dialog.dispose()
}

const normalizeTextCode = (code: string) => code.replace(/\W+/g, ' ').trim()
const secretAnswer = (code: string) => ({phrase: normalizeTextCode(code), secret: null as unknown as Uint8Array})

type Submits = {
  deviceName: (name: string) => void
  deviceSelect: (name: string) => void
  passphrase: (passphrase: string) => void
  textCode: (code: string) => void
}
// The run the provision screens answer: a login or an add-device. Starting one cancels the other.
// Kept outside the stores: login logs out first, and that logout must not stop its screens answering.
type ProvisionRun = {
  cancel: () => void
  pause: () => void
  submit: Partial<Submits>
}
let currentProvisionRun: ProvisionRun | undefined

export const cancelProvision = () => currentProvisionRun?.cancel()
// Back-out while the RPC is mid-work: abort the attempt but keep the run's answers so a
// resubmit replays them. In the add-device flow this is a full cancel (nothing to replay).
export const pauseProvision = () => currentProvisionRun?.pause()
export const submitProvisionDeviceName = (name: string) => currentProvisionRun?.submit.deviceName?.(name)
export const submitProvisionDeviceSelect = (name: string) => currentProvisionRun?.submit.deviceSelect?.(name)
export const submitProvisionPassphrase = (passphrase: string) =>
  currentProvisionRun?.submit.passphrase?.(passphrase)
export const submitProvisionTextCode = (code: string) => currentProvisionRun?.submit.textCode?.(code)

export const startProvision = (name = '', fromReset = false) => {
  cancelProvision()
  useConfigState.getState().dispatch.setLoginError()
  useConfigState.getState().dispatch.resetRevokedSelf()
  const f = async () => {
    // If we're logged in, we're coming from the user switcher; log out first to prevent the service
    // from getting out of sync with the GUI about our logged-in-ness
    if (useConfigState.getState().loggedIn) {
      await T.RPCGen.loginLogoutRpcPromise({force: false, keepSecrets: true}, waitingKeyConfigLoginAsOther)
    }
  }
  ignorePromise(f())
  navigateAppend({name: 'username', params: {fromReset, username: name}})
}

// A changed username always restarts provisioning from scratch
export const submitProvisionUsername = (username: string) => {
  cancelProvision()
  runProvision(username)
}

type LoginPrompt = (typeof loginPrompts)[number]
type LoginNotice = (typeof loginNotices)[number]
type LoginDialog = Dialog<void, LoginPrompt, LoginNotice>

// Why the run disposed its attempt. A cancel outranks a restart, which outranks a pause.
type EndReason = 'park' | 'restart' | 'cancel'
const endReasonRank = {cancel: 3, park: 1, restart: 2} as const

// Runs the login RPC and services its prompts. The RPC has no notion of going back to an earlier
// step, so when the user does, we record the changed answer, cancel the in-flight RPC, and run it
// again, auto-submitting the recorded answers up to the changed step.
const runProvision = (username: string) => {
  const answers = {
    deviceName: '',
    passphrase: '',
    selectedDevice: makeDevice(),
  }
  let knownDevices: Array<Device> = []
  const autoSubmit: Array<Step> = [{type: 'username'}]
  let attempt: LoginDialog | undefined
  let endReason: EndReason | undefined
  // Set when the attempt could not show one of its prompts, which ended it
  let showFailed = false
  let resumeParked: (() => void) | undefined
  // The prompt each step's screen answers, from when it's shown until the user answers any step or
  // backs out. A submit of a step with none is the user going back to change an earlier answer.
  let showing: {
    deviceName?: Prompt<typeof deviceNamePrompt>
    deviceSelect?: Prompt<typeof chooseDevicePrompt>
    passphrase?: Prompt<typeof passphrasePrompt>
    textCode?: Prompt<typeof secretPrompt>
  } = {}

  const endAttempt = (reason: EndReason) => {
    if (!endReason || endReasonRank[reason] > endReasonRank[endReason]) {
      endReason = reason
    }
    attempt?.dispose()
  }

  // Read through calls: the loop resets these, and TypeScript would keep that narrowing across the
  // awaits during which a cancel, pause, resubmit or failed prompt sets them
  const whyEnded = () => endReason
  const failedToShow = () => showFailed

  const wakeParked = () => {
    resumeParked?.()
    resumeParked = undefined
  }

  const requestRestart = () => {
    endAttempt('restart')
    wakeParked()
  }

  // add a new value to submit and clear things behind
  const updateAutoSubmit = (step: Step) => {
    const idx = autoSubmit.findIndex(a => a.type === step.type)
    if (idx !== -1) {
      autoSubmit.splice(idx)
    }
    autoSubmit.push(step)
  }

  // Answers the prompt the step's screen shows, or starts over if it shows none. A prompt the
  // service already settled takes nothing.
  const answerOrRestart = <K extends keyof typeof showing>(
    step: K,
    answer: (p: NonNullable<(typeof showing)[K]>) => void
  ) => {
    const p = showing[step]
    if (!p) {
      requestRestart()
      return
    }
    showing = {}
    answer(p)
  }

  const submit: Submits = {
    deviceName: name => {
      answers.deviceName = name
      updateAutoSubmit({type: 'deviceName'})
      answerOrRestart('deviceName', p => p.answer(name))
    },
    deviceSelect: name => {
      const selectedDevice = knownDevices.find(d => d.name === name)
      if (!selectedDevice) {
        logger.warn('Provision: selected a non-existent device?')
        return
      }
      answers.selectedDevice = selectedDevice
      updateAutoSubmit({devices: knownDevices, type: 'chooseDevice'})
      answerOrRestart('deviceSelect', p => p.answer(selectedDevice.id))
    },
    passphrase: passphrase => {
      answers.passphrase = passphrase
      updateAutoSubmit({type: 'passphrase'})
      answerOrRestart('passphrase', p => p.answer({passphrase, storeSecret: false}))
    },
    textCode: code => {
      if (!showing.textCode) {
        console.log('Provision: unwatched submitTextCode called')
      }
      answerOrRestart('textCode', p => p.answer(secretAnswer(code)))
    },
  }

  const run: ProvisionRun = {
    cancel: () => {
      endAttempt('cancel')
      wakeParked()
    },
    pause: () => {
      endAttempt('park')
      showing = {}
    },
    submit,
  }
  currentProvisionRun = run

  const runAttempt = async (dialog: LoginDialog) => {
    // freeze the autosubmit for this attempt so changes don't affect us
    const frozenAutoSubmit = [...autoSubmit]
    console.log('Provision: starting attempt with auto submit', frozenAutoSubmit)
    let submitStep = 0
    const shouldAutoSubmit = (hadError: boolean, step: Step) => {
      if (!hadError) {
        ++submitStep
      }
      return isEqual(frozenAutoSubmit[submitStep], step)
    }
    const exchange = makeExchangeHold(dialog)
    const showEvent = (e: DialogEvent<LoginPrompt, LoginNotice>) => {
      if (e.kind === 'notice') {
        if (e.method === secretExchanged) {
          exchange.hold()
        }
        return
      }
      exchange.release()
      switch (e.method) {
        case secretPrompt: {
          const {phrase, previousErr} = e.params
          showing.textCode = e
          // we ignore the return as we never autosubmit, but we want things to increment
          shouldAutoSubmit(!!previousErr, {type: 'promptSecret'})
          navigateAppend(
            {
              name: 'codePage',
              params: {
                deviceName: answers.deviceName,
                error: previousErr || undefined,
                otherDevice: answers.selectedDevice,
                textCode: phrase,
              },
            },
            !!previousErr
          )
          return
        }
        case deviceNamePrompt: {
          const {errorMessage} = e.params
          showing.deviceName = e
          if (shouldAutoSubmit(!!errorMessage, {type: 'deviceName'})) {
            console.log('Provision: auto submit device name')
            submit.deviceName(answers.deviceName)
          } else {
            navigateAppend(
              {name: 'setPublicName', params: {devices: knownDevices, error: errorMessage || undefined}},
              !!errorMessage
            )
          }
          return
        }
        case chooseDevicePrompt: {
          const devices = e.params.devices?.map(d => rpcDeviceToDevice(d)) ?? []
          knownDevices = devices
          showing.deviceSelect = e
          if (shouldAutoSubmit(false, {devices, type: 'chooseDevice'})) {
            console.log('Provision: auto submit device select')
            submit.deviceSelect(answers.selectedDevice.name)
          } else {
            navigateAppend({name: 'selectOtherDevice', params: {devices, username}})
          }
          return
        }
        case passphrasePrompt: {
          const {retryLabel, type} = e.params.pinentry
          // The service may ask again with a type the flow shows
          if (type !== T.RPCGen.PassphraseType.passPhrase && type !== T.RPCGen.PassphraseType.paperKey) {
            logger.warn('Provision: got confused about password entry')
            e.cancel()
            return
          }
          showing.passphrase = e
          // Service asking us again due to an error?
          const error = (retryLabel === invalidPasswordErrorString ? 'Incorrect password.' : retryLabel) || undefined
          if (shouldAutoSubmit(!!retryLabel, {type: 'passphrase'})) {
            console.log('Provision: auto submit passphrase')
            submit.passphrase(answers.passphrase)
          } else if (type === T.RPCGen.PassphraseType.passPhrase) {
            navigateAppend({name: 'password', params: {error, username}}, !!retryLabel)
          } else {
            navigateAppend(
              {name: 'paperkey', params: {deviceName: answers.selectedDevice.name, error}},
              !!retryLabel
            )
          }
          return
        }
        default:
          e.cancel()
      }
    }

    const showEvents = async () => {
      for await (const e of dialog.events) {
        try {
          showEvent(e)
        } catch (error) {
          showFailed = true
          endOnShowFailure(dialog, e.method, error)
        }
      }
    }

    await Promise.all([showEvents(), dialog.done])
  }

  const openAttempt = (): LoginDialog =>
    openDialog(
      'keybase.1.login.login',
      {
        clientType: T.RPCGen.ClientType.guiMain,
        deviceName: '',
        deviceType: isMobile ? 'mobile' : 'desktop',
        doUserSwitch: true,
        paperKey: '',
        username,
      },
      {
        autoAnswer: {
          // The "I lost all my devices" row owns reset, so login never enters it from here
          'keybase.1.loginUi.promptResetAccount': () => T.RPCGen.ResetPromptResponse.nothing,
        },
        notices: loginNotices,
        prompts: loginPrompts,
        waitingKey: waitingKeyProvision,
      }
    )

  // Parked: the user backed out of a hung attempt. Waits for a resubmit (a submit with no prompt
  // showing restarts) or a cancel.
  const parkUntilResumed = async () =>
    new Promise<void>(resolve => {
      resumeParked = resolve
    })

  const f = async () => {
    try {
      for (;;) {
        endReason = undefined
        showFailed = false
        const dialog = openAttempt()
        attempt = dialog
        try {
          // eslint-disable-next-line no-await-in-loop
          await runAttempt(dialog)
          useDaemonState.getState().dispatch.refreshSessionFromDaemon('provision login returned')
          break
        } catch (_finalError) {
          if (failedToShow()) {
            showProvisionError(showFailedError, true, username)
            break
          }
          if (dialog.disposed) {
            if (whyEnded() === 'restart') {
              continue
            }
            if (whyEnded() === 'park') {
              // eslint-disable-next-line no-await-in-loop
              await parkUntilResumed()
              if (whyEnded() === 'cancel') {
                break
              }
              continue
            }
            break
          }
          if (!(_finalError instanceof RPCError)) {
            console.log('Provision non rpc error at end?', _finalError)
            break
          }
          const finalError = _finalError
          // A cancel ends the run quietly: ours (a logout, an account switch) or the service's. A lost
          // link is an error.
          if (isCancelled(finalError, 'caller', 'accountChange', 'service')) {
            break
          }
          // If it's a non-existent username or invalid, allow the opportunity to correct it right
          // there on the page.
          switch (finalError.code) {
            case T.RPCGen.StatusCode.scnotfound:
            case T.RPCGen.StatusCode.scbadusername:
              navigateAppend({name: 'username', params: {inlineErrorCode: finalError.code, username}}, true)
              break
            default:
              if (!errorCausedByUsCanceling(finalError)) {
                showProvisionError(finalError, true, username)
              }
              break
          }
          break
        }
      }
    } finally {
      if (currentProvisionRun === run) {
        currentProvisionRun = undefined
      }
    }
  }
  ignorePromise(f())
}

export const startAddNewDevice = (otherDeviceType: 'desktop' | 'mobile') => {
  cancelProvision()
  const otherDevice = {...makeDevice(), type: otherDeviceType}
  const dialog = openDialog('keybase.1.device.deviceAdd', undefined, {
    autoAnswer: {
      'keybase.1.provisionUi.chooseDeviceType': () =>
        otherDeviceType === 'mobile' ? T.RPCGen.DeviceType.mobile : T.RPCGen.DeviceType.desktop,
    },
    notices: [secretExchanged, ...successNotices],
    prompts: [secretPrompt],
    waitingKey: waitingKeyProvision,
  })
  // There's nothing to replay in this flow, so pause is a full cancel too
  const run: ProvisionRun = {
    cancel: dialog.dispose,
    pause: dialog.dispose,
    submit: {
      textCode: code => {
        dialog.openPrompt(secretPrompt)?.answer(secretAnswer(code))
      },
    },
  }
  currentProvisionRun = run

  const exchange = makeExchangeHold(dialog)
  // Set when a prompt could not be shown, which ended the run
  let showFailed = false
  const showEvents = async () => {
    for await (const e of dialog.events) {
      if (e.kind === 'notice') {
        if (e.method === secretExchanged) {
          exchange.hold()
        }
        continue
      }
      exchange.release()
      try {
        const {phrase, previousErr} = e.params
        navigateAppend(
          {name: 'codePage', params: {error: previousErr || undefined, otherDevice, textCode: phrase}},
          !!previousErr
        )
      } catch (error) {
        showFailed = true
        endOnShowFailure(dialog, e.method, error)
      }
    }
  }

  const f = async () => {
    try {
      await Promise.all([showEvents(), dialog.done])
    } catch {
    } finally {
      if (currentProvisionRun === run) {
        currentProvisionRun = undefined
      }
    }
    if (showFailed) {
      showProvisionError(showFailedError, false)
      return
    }
    // A run the user cancelled (or a newer run or a logout superseded) must not clear modals: by now
    // the user has either navigated away or a newer run owns the screens. Any other end closes them,
    // a cancel from the service included.
    if (!dialog.disposed) {
      clearModals()
    }
  }
  ignorePromise(f())
}
