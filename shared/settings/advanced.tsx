import * as C from '@/constants'
import * as Constants from '@/constants/settings'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as React from 'react'
import {ProxySettings} from './proxy/container'

let initialUseNativeFrame: boolean | undefined

const showMakeIcons = __DEV__ && (false as boolean)

const UseNativeFrame = () => {
  const useNativeFrame = C.useConfigState(s => s.useNativeFrame)
  const onChangeUseNativeFrame = C.useConfigState(s => s.dispatch.setUseNativeFrame)
  if (initialUseNativeFrame === undefined) {
    initialUseNativeFrame = useNativeFrame
  }
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

const LockdownCheckbox = (p: {hasRandomPW: boolean; settingLockdownMode: boolean}) => {
  const {hasRandomPW, settingLockdownMode} = p
  const lockdownModeEnabled = C.useSettingsState(s => !!s.lockdownModeEnabled)
  const setLockdownMode = C.useSettingsState(s => s.dispatch.setLockdownMode)
  const onChangeLockdownMode = setLockdownMode
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
          <Kb.Text type="BodySmallPrimaryLink" onClickURL="https://keybase.io/docs/lockdown/index">
            Read more{' '}
            <Kb.Icon
              type="iconfont-open-browser"
              sizeType="Tiny"
              boxStyle={styles.displayInline}
              color={Kb.Styles.globalColors.blueDark}
            />
          </Kb.Text>
        </Kb.Box2>
      }
    />
  )
}

const Advanced = () => {
  const settingLockdownMode = C.Waiting.useAnyWaiting(Constants.setLockdownModeWaitingKey)
  const hasRandomPW = C.useSettingsPasswordState(s => !!s.randomPW)
  const openAtLogin = C.useConfigState(s => s.openAtLogin)
  const rememberPassword = C.useSettingsPasswordState(s => s.rememberPassword)
  const setLockdownModeError = C.Waiting.useAnyErrors(Constants.setLockdownModeWaitingKey)?.message || ''
  const setRememberPassword = C.useSettingsPasswordState(s => s.dispatch.setRememberPassword)
  const onChangeRememberPassword = setRememberPassword
  const onSetOpenAtLogin = C.useConfigState(s => s.dispatch.setOpenAtLogin)

  const [disableSpellCheck, setDisableSpellcheck] = React.useState<boolean | undefined>(undefined)

  const initialDisableSpellCheck = React.useRef<boolean | undefined>(undefined)
  const loadDisableSpellcheck = C.useRPC(T.RPCGen.configGuiGetValueRpcPromise)

  // load it
  if (disableSpellCheck === undefined) {
    setTimeout(() => {
      loadDisableSpellcheck(
        [{path: 'ui.disableSpellCheck'}],
        result => {
          const res = result.b ?? false
          initialDisableSpellCheck.current = res
          setDisableSpellcheck(res)
        },
        () => {
          setDisableSpellcheck(false)
        }
      )
    }, 1)
  }
  const submitDisableSpellcheck = C.useRPC(T.RPCGen.configGuiSetValueRpcPromise)

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

  const loadHasRandomPw = C.useSettingsPasswordState(s => s.dispatch.loadHasRandomPw)
  const loadRememberPassword = C.useSettingsPasswordState(s => s.dispatch.loadRememberPassword)
  const loadLockdownMode = C.useSettingsState(s => s.dispatch.loadLockdownMode)

  React.useEffect(() => {
    loadHasRandomPw()
    loadLockdownMode()
    loadRememberPassword()
  }, [loadRememberPassword, loadHasRandomPw, loadLockdownMode])

  return (
    <Kb.ScrollView style={styles.scrollview}>
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true} style={styles.section}>
          {settingLockdownMode && <Kb.ProgressIndicator />}
          <LockdownCheckbox hasRandomPW={hasRandomPW} settingLockdownMode={settingLockdownMode} />
          {!!setLockdownModeError && (
            <Kb.Text type="BodySmall" style={styles.error}>
              {setLockdownModeError}
            </Kb.Text>
          )}
          {!hasRandomPW && (
            <Kb.Checkbox
              checked={rememberPassword}
              labelComponent={
                <Kb.Box2 direction="vertical" style={Kb.Styles.globalStyles.flexOne}>
                  <Kb.Text type="Body">Always stay logged in</Kb.Text>
                  <Kb.Text type="BodySmall">
                    You won't be asked for your password when restarting the app or your device.
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
                (initialDisableSpellCheck.current === disableSpellCheck ? '' : ' (restart required)')
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
  )
}

const clickThreshold = 7
const traceDurationSeconds = 30
const processorProfileDurationSeconds = 30

const Developer = () => {
  const [clickCount, setClickCount] = React.useState(0)

  const setDebugLevel = C.useFSState(s => s.dispatch.setDebugLevel)
  const onExtraKBFSLogging = () => setDebugLevel('vlog2')
  const onToggleRuntimeStats = C.useConfigState(s => s.dispatch.toggleRuntimeStats)
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
  const traceInProgress = C.Waiting.useAnyWaiting(Constants.traceInProgressKey)

  const trace = C.useSettingsState(s => s.dispatch.trace)
  const processorProfile = C.useSettingsState(s => s.dispatch.processorProfile)
  const onTrace = trace
  const processorProfileInProgress = C.Waiting.useAnyWaiting(Constants.processorProfileInProgressKey)
  const onProcessorProfile = processorProfile
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onDBNuke = () => navigateAppend('dbNukeConfirm')
  const onMakeIcons = () => navigateAppend('makeIcons')

  return (
    <Kb.Box style={styles.developerContainer}>
      <Kb.Text center={true} type="BodySmallSemibold" onClick={onLabelClick} style={styles.text}>
        Please don't do anything below here unless instructed to by a developer.
      </Kb.Text>
      <Kb.Divider style={styles.divider} />
      <Kb.Button style={styles.developerButtons} type="Danger" label="DB Nuke" onClick={onDBNuke} />
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
      <Kb.Box style={styles.filler} />
    </Kb.Box>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  checkboxContainer: {
    ...Kb.Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    paddingBottom: Kb.Styles.globalMargins.tiny,
    paddingTop: Kb.Styles.globalMargins.tiny,
    width: '100%',
  },
  developerButtons: {
    marginTop: Kb.Styles.globalMargins.small,
  },
  developerContainer: {
    ...Kb.Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    flex: 1,
    paddingBottom: Kb.Styles.globalMargins.medium,
  },
  displayInline: Kb.Styles.platformStyles({isElectron: {display: 'inline'}}),
  divider: {
    marginTop: Kb.Styles.globalMargins.xsmall,
    width: '100%',
  },
  error: {
    color: Kb.Styles.globalColors.redDark,
  },
  filler: {
    flex: 1,
  },
  progressContainer: {
    ...Kb.Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
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
}))

export default Advanced
