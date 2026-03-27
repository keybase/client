import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as React from 'react'
import {ProxySettings} from './proxy'
import {processorProfileInProgressKey, traceInProgressKey} from '@/constants/settings'
import {usePWState} from '@/stores/settings-password'
import {useFSState} from '@/stores/fs'
import {useConfigState} from '@/stores/config'
import {ignorePromise, timeoutPromise} from '@/constants/utils'
import {pprofDir} from '@/constants/platform'
import {clearLocalLogs} from '@/util/misc'
import {useWaitingState} from '@/stores/waiting'

let initialUseNativeFrame: boolean | undefined

const showMakeIcons = __DEV__ && (false as boolean)

const runPprofAction = (
  rpc: () => Promise<void>,
  waitingKey: string,
  durationSeconds: number
) => {
  const f = async () => {
    await rpc()
    const {decrement, increment} = useWaitingState.getState().dispatch
    increment(waitingKey)
    await timeoutPromise(durationSeconds * 1_000)
    decrement(waitingKey)
  }
  ignorePromise(f())
}

const useLockdownMode = () => {
  const [lockdownModeEnabled, setLockdownModeEnabled] = React.useState<boolean | undefined>(undefined)
  const loadLockdownModeRPC = C.useRPC(T.RPCGen.accountGetLockdownModeRpcPromise)
  const setLockdownModeRPC = C.useRPC(T.RPCGen.accountSetLockdownModeRpcPromise)

  const loadLockdownMode = React.useCallback(() => {
    if (!useConfigState.getState().loggedIn) {
      return
    }
    loadLockdownModeRPC(
      [undefined],
      result => {
        setLockdownModeEnabled(result.status)
      },
      () => {
        setLockdownModeEnabled(undefined)
      }
    )
  }, [loadLockdownModeRPC])

  const setLockdownMode = React.useCallback(
    (enabled: boolean) => {
      if (!useConfigState.getState().loggedIn) {
        return
      }
      setLockdownModeRPC(
        [{enabled}, C.waitingKeySettingsSetLockdownMode],
        () => {
          setLockdownModeEnabled(enabled)
        },
        () => {
          setLockdownModeEnabled(undefined)
        }
      )
    },
    [setLockdownModeRPC]
  )

  return {loadLockdownMode, lockdownModeEnabled, setLockdownMode}
}

const UseNativeFrame = () => {
  const {onChangeUseNativeFrame, useNativeFrame} = useConfigState(
    C.useShallow(s => ({
      onChangeUseNativeFrame: s.dispatch.setUseNativeFrame,
      useNativeFrame: s.useNativeFrame,
    }))
  )
  React.useEffect(() => {
    if (initialUseNativeFrame === undefined) {
      initialUseNativeFrame = useNativeFrame
    }
  }, [useNativeFrame])
  return C.isMobile ? null : (
    <>
      <Kb.Checkbox
        checked={!useNativeFrame}
        label="Hide system window frame"
        onCheck={x => onChangeUseNativeFrame(!x)}
      />
      {initialUseNativeFrame !== useNativeFrame && (
        <Kb.Text type="BodySmall" style={styles.error}>
          Keybase needs to restart for this change to take effect.
        </Kb.Text>
      )}
    </>
  )
}

const LockdownCheckbox = (p: {
  hasRandomPW: boolean
  lockdownModeEnabled?: boolean
  setLockdownMode: (enabled: boolean) => void
  settingLockdownMode: boolean
}) => {
  const {hasRandomPW, lockdownModeEnabled, setLockdownMode, settingLockdownMode} = p
  const onChangeLockdownMode = setLockdownMode
  const readMoreUrlProps = Kb.useClickURL('https://keybase.io/docs/lockdown/index')
  const label = 'Enable account lockdown mode' + (hasRandomPW ? ' (you need to set a password first)' : '')
  const checked = hasRandomPW || !!lockdownModeEnabled
  const disabled = hasRandomPW || settingLockdownMode
  return (
    <Kb.Checkbox
      checked={checked}
      disabled={disabled}
      onCheck={onChangeLockdownMode}
      labelComponent={
        <Kb.Box2 direction="vertical" alignItems="flex-start" style={Kb.Styles.globalStyles.flexOne}>
          <Kb.Text type="Body">{label}</Kb.Text>
          <Kb.Text type="BodySmall">Prevent making account changes from the website.</Kb.Text>
          <Kb.Text type="BodySmall">
            With this setting on you will not be able to reset your account, even from the app. Protect your
            account by installing Keybase on several devices, or by keeping a paper key in a safe place.
          </Kb.Text>
          <Kb.Text type="BodySmallPrimaryLink" {...readMoreUrlProps}>
            Read more{' '}
            <Kb.Icon
              type="iconfont-open-browser"
              sizeType="Tiny"
              color={Kb.Styles.globalColors.blueDark}
            />
          </Kb.Text>
        </Kb.Box2>
      }
    />
  )
}

let disableSpellCheckInitialValue: boolean | undefined

const Advanced = () => {
  const settingLockdownMode = C.Waiting.useAnyWaiting(C.waitingKeySettingsSetLockdownMode)
  const {hasRandomPW, loadHasRandomPw} = usePWState(
    C.useShallow(s => ({
      hasRandomPW: !!s.randomPW,
      loadHasRandomPw: s.dispatch.loadHasRandomPw,
    }))
  )
  const {onSetOpenAtLogin, openAtLogin} = useConfigState(
    C.useShallow(s => ({
      onSetOpenAtLogin: s.dispatch.setOpenAtLogin,
      openAtLogin: s.openAtLogin,
    }))
  )
  const {loadLockdownMode, lockdownModeEnabled, setLockdownMode} = useLockdownMode()
  const setLockdownModeError = C.Waiting.useAnyErrors(C.waitingKeySettingsSetLockdownMode)?.message || ''
  const [rememberPassword, setRememberPassword] = React.useState<boolean | undefined>(undefined)

  const [disableSpellCheck, setDisableSpellcheck] = React.useState<boolean | undefined>(undefined)
  const loadDisableSpellcheck = C.useRPC(T.RPCGen.configGuiGetValueRpcPromise)
  const loadRememberPassword = C.useRPC(T.RPCGen.configGetRememberPassphraseRpcPromise)
  const submitRememberPassword = C.useRPC(T.RPCGen.configSetRememberPassphraseRpcPromise)

  // load it
  React.useEffect(() => {
    if (disableSpellCheck === undefined) {
      loadDisableSpellcheck(
        [{path: 'ui.disableSpellCheck'}],
        result => {
          const res = result.b ?? false
          setDisableSpellcheck(res)
          if (disableSpellCheckInitialValue === undefined) {
            disableSpellCheckInitialValue = res
          }
        },
        () => {
          setDisableSpellcheck(false)
          if (disableSpellCheckInitialValue === undefined) {
            disableSpellCheckInitialValue = false
          }
        }
      )
    }
  }, [disableSpellCheck, loadDisableSpellcheck])

  React.useEffect(() => {
    if (rememberPassword === undefined) {
      loadRememberPassword(
        [undefined],
        remember => {
          setRememberPassword(remember)
        },
        () => {
          setRememberPassword(true)
        }
      )
    }
  }, [loadRememberPassword, rememberPassword])

  const submitDisableSpellcheck = C.useRPC(T.RPCGen.configGuiSetValueRpcPromise)
  const onChangeRememberPassword = (remember: boolean) => {
    const previous = rememberPassword
    setRememberPassword(remember)
    submitRememberPassword(
      [{remember}],
      () => {},
      () => {
        setRememberPassword(previous)
      }
    )
  }

  const onToggleDisableSpellcheck = () => {
    const next = !disableSpellCheck
    setDisableSpellcheck(next)
    submitDisableSpellcheck(
      [
        {
          path: 'ui.disableSpellCheck',
          value: {b: next, isNull: false},
        },
      ],
      () => {},
      () => {
        console.log('cant save spell check?')
        setDisableSpellcheck(!next)
      }
    )
  }

  React.useEffect(() => {
    loadHasRandomPw()
    loadLockdownMode()
  }, [loadHasRandomPw, loadLockdownMode])

  return (
    <Kb.KeyboardAvoidingView2>
      <Kb.ScrollView style={styles.scrollview}>
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true} style={styles.section}>
            {settingLockdownMode && <Kb.ProgressIndicator />}
            <LockdownCheckbox
              hasRandomPW={hasRandomPW}
              lockdownModeEnabled={lockdownModeEnabled}
              setLockdownMode={setLockdownMode}
              settingLockdownMode={settingLockdownMode}
            />
            {!!setLockdownModeError && (
              <Kb.Text type="BodySmall" style={styles.error}>
                {setLockdownModeError}
              </Kb.Text>
            )}
            {!hasRandomPW && (
              <Kb.Checkbox
                checked={!!rememberPassword}
                disabled={rememberPassword === undefined}
                labelComponent={
                  <Kb.Box2 direction="vertical" style={Kb.Styles.globalStyles.flexOne}>
                    <Kb.Text type="Body">Always stay logged in</Kb.Text>
                    <Kb.Text type="BodySmall">
                      {"You won't be asked for your password when restarting the app or your device."}
                    </Kb.Text>
                  </Kb.Box2>
                }
                onCheck={onChangeRememberPassword}
              />
            )}
            {C.isLinux ? <UseNativeFrame /> : null}
            {!C.isMobile && (
              <Kb.Checkbox label="Open Keybase on startup" checked={openAtLogin} onCheck={onSetOpenAtLogin} />
            )}
            {!C.isMobile && (
              <Kb.Checkbox
                label={
                  'Disable spellchecking' +
                  (disableSpellCheckInitialValue !== undefined &&
                  disableSpellCheckInitialValue !== disableSpellCheck
                    ? ' (restart required)'
                    : '')
                }
                disabled={disableSpellCheck === undefined}
                checked={!!disableSpellCheck}
                onCheck={onToggleDisableSpellcheck}
              />
            )}
          </Kb.Box2>
          <Kb.Divider style={styles.proxyDivider} />
          <Kb.Box2
            direction="vertical"
            fullWidth={true}
            style={Kb.Styles.collapseStyles([styles.section, {paddingTop: 0}])}
          >
            <ProxySettings />
          </Kb.Box2>
          <Developer />
        </Kb.Box2>
      </Kb.ScrollView>
    </Kb.KeyboardAvoidingView2>
  )
}

const clickThreshold = 7
const traceDurationSeconds = 30
const processorProfileDurationSeconds = 30

const Developer = () => {
  const [clickCount, setClickCount] = React.useState(0)

  const setDebugLevel = useFSState(s => s.dispatch.setDebugLevel)
  const onExtraKBFSLogging = () => setDebugLevel('vlog2')
  const onToggleRuntimeStats = useConfigState(s => s.dispatch.toggleRuntimeStats)
  const onLabelClick = () =>
    setClickCount(s => {
      const next = s + 1
      if (next < clickThreshold) {
        console.log(
          `clickCount = ${clickCount} (${clickThreshold - clickCount} away from showing developer controls)`
        )
      }
      return next
    })

  const showPprofControls = clickCount >= clickThreshold
  const traceInProgress = C.Waiting.useAnyWaiting(traceInProgressKey)
  const onProcessorProfile = () => {
    runPprofAction(
      async () =>
        T.RPCGen.pprofLogProcessorProfileRpcPromise({
          logDirForMobile: pprofDir,
          profileDurationSeconds: processorProfileDurationSeconds,
        }),
      processorProfileInProgressKey,
      processorProfileDurationSeconds
    )
  }
  const onTrace = () => {
    runPprofAction(
      async () =>
        T.RPCGen.pprofLogTraceRpcPromise({
          logDirForMobile: pprofDir,
          traceDurationSeconds,
        }),
      traceInProgressKey,
      traceDurationSeconds
    )
  }
  const processorProfileInProgress = C.Waiting.useAnyWaiting(processorProfileInProgressKey)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onDBNuke = () => navigateAppend('dbNukeConfirm')
  const onMakeIcons = () => navigateAppend('makeIcons')
  const onClearLogs = () => {
    const f = async () => {
      await clearLocalLogs()
    }
    ignorePromise(f())
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} alignItems="center" flex={1} style={styles.developerContainer}>
      <Kb.Text center={true} type="BodySmallSemibold" onClick={onLabelClick} style={styles.text}>
        {"Please don't do anything below here unless instructed to by a developer."}
      </Kb.Text>
      <Kb.Divider style={styles.divider} />
      <Kb.Button style={styles.developerButtons} type="Danger" label="DB Nuke" onClick={onDBNuke} />
      {Kb.Styles.isIOS ? (
        <Kb.Button
          style={styles.developerButtons}
          mode="Secondary"
          label="Clear Logs"
          onClick={onClearLogs}
        />
      ) : null}
      <Kb.Button
        style={styles.developerButtons}
        mode="Secondary"
        label="Enable Detailed Logging"
        onClick={onExtraKBFSLogging}
      />

      {showMakeIcons && (
        <Kb.Button
          style={styles.developerButtons}
          mode="Secondary"
          label="Make Icons"
          onClick={onMakeIcons}
        />
      )}
      {showPprofControls && (
        <>
          <Kb.Button
            label="Toggle Runtime Stats"
            onClick={onToggleRuntimeStats}
            mode="Secondary"
            style={styles.developerButtons}
          />
          <Kb.Button
            waiting={traceInProgress}
            style={{marginTop: Kb.Styles.globalMargins.small}}
            type="Danger"
            label={`Trace (${traceDurationSeconds}s)`}
            onClick={() => onTrace(traceDurationSeconds)}
          />
          <Kb.Button
            waiting={processorProfileInProgress}
            style={{marginTop: Kb.Styles.globalMargins.small}}
            type="Danger"
            label={`CPU Profile (${traceDurationSeconds}s)`}
            onClick={() => onProcessorProfile(processorProfileDurationSeconds)}
          />
          <Kb.Text center={true} type="BodySmallSemibold" style={styles.text}>
            Trace and profile files are included in logs sent with feedback.
          </Kb.Text>
        </>
      )}
      <Kb.Box2 direction="vertical" flex={1} />
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      developerButtons: {
        marginTop: Kb.Styles.globalMargins.small,
      },
      developerContainer: {
        paddingBottom: Kb.Styles.globalMargins.medium,
      },
      divider: {
        marginTop: Kb.Styles.globalMargins.xsmall,
        width: '100%',
      },
      error: {
        color: Kb.Styles.globalColors.redDark,
      },
      proxyDivider: {
        marginBottom: Kb.Styles.globalMargins.small,
        marginTop: Kb.Styles.globalMargins.small,
        width: '100%',
      },
      scrollview: {
        width: '100%',
      },
      section: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.padding(
            Kb.Styles.globalMargins.small,
            Kb.Styles.globalMargins.mediumLarge,
            Kb.Styles.globalMargins.medium,
            Kb.Styles.globalMargins.small
          ),
        },
        isElectron: {
          maxWidth: 600,
        },
      }),
      text: Kb.Styles.platformStyles({
        isElectron: {
          cursor: 'default',
        },
      }),
    }) as const
)

export default Advanced
