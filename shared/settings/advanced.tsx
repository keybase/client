import * as ConfigGen from '../actions/config-gen'
import * as Constants from '../constants/settings'
import * as Container from '../util/container'
import * as FSGen from '../actions/fs-gen'
import * as Kb from '../common-adapters'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as SettingsGen from '../actions/settings-gen'
import * as Styles from '../styles'
import {ProxySettings} from './proxy/container'
import {anyErrors, anyWaiting} from '../constants/waiting'
import {isMobile, isLinux, isWindows} from '../constants/platform'
import {toggleRenderDebug} from '../router-v2/shim.shared'

let initialUseNativeFrame: boolean | undefined

const UseNativeFrame = () => {
  const dispatch = Container.useDispatch()
  const useNativeFrame = Container.useSelector(state => state.config.useNativeFrame)
  const onChangeUseNativeFrame = (useNativeFrame: boolean) =>
    dispatch(ConfigGen.createSetUseNativeFrame({useNativeFrame}))
  if (initialUseNativeFrame === undefined) {
    initialUseNativeFrame = useNativeFrame
  }
  return isMobile ? null : (
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
  const dispatch = Container.useDispatch()
  const {hasRandomPW, settingLockdownMode} = p
  const lockdownModeEnabled = Container.useSelector(state => !!state.settings.lockdownModeEnabled)
  const onChangeLockdownMode = (enabled: boolean) =>
    dispatch(SettingsGen.createOnChangeLockdownMode({enabled}))
  const label = 'Enable account lockdown mode' + (hasRandomPW ? ' (you need to set a password first)' : '')
  const checked = hasRandomPW || !!lockdownModeEnabled
  const disabled = lockdownModeEnabled === null || hasRandomPW || settingLockdownMode
  return (
    <Kb.Checkbox
      checked={checked}
      disabled={disabled}
      onCheck={onChangeLockdownMode}
      labelComponent={
        <Kb.Box2 direction="vertical" alignItems="flex-start" style={Styles.globalStyles.flexOne}>
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
              color={Styles.globalColors.blueDark}
            />
          </Kb.Text>
        </Kb.Box2>
      }
    />
  )
}

const Advanced = () => {
  const dispatch = Container.useDispatch()

  const settingLockdownMode = Container.useSelector(state =>
    anyWaiting(state, Constants.setLockdownModeWaitingKey)
  )
  const hasRandomPW = Container.useSelector(state => !!state.settings.password.randomPW)
  const openAtLogin = Container.useSelector(state => state.config.openAtLogin)
  const rememberPassword = Container.useSelector(state => state.settings.password.rememberPassword)
  const setLockdownModeError =
    Container.useSelector(state => anyErrors(state, Constants.setLockdownModeWaitingKey))?.message || ''
  const onChangeRememberPassword = (remember: boolean) =>
    dispatch(SettingsGen.createOnChangeRememberPassword({remember}))
  const onSetOpenAtLogin = (openAtLogin: boolean) => dispatch(ConfigGen.createSetOpenAtLogin({openAtLogin}))

  const [disableSpellCheck, setDisableSpellcheck] = React.useState<boolean | undefined>(undefined)

  const initialDisableSpellCheck = React.useRef<boolean | undefined>(undefined)
  const loadDisableSpellcheck = Container.useRPC(RPCTypes.configGuiGetValueRpcPromise)

  // load it
  if (disableSpellCheck === undefined) {
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
  }
  const submitDisableSpellcheck = Container.useRPC(RPCTypes.configGuiSetValueRpcPromise)

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
    dispatch(SettingsGen.createLoadHasRandomPw())
    dispatch(SettingsGen.createLoadLockdownMode())
    ;(isLinux || isWindows) && dispatch(ConfigGen.createLoadOnLoginStartup())
    dispatch(SettingsGen.createLoadRememberPassword())
  }, [dispatch])

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
                <Kb.Box2 direction="vertical" style={Styles.globalStyles.flexOne}>
                  <Kb.Text type="Body">Always stay logged in</Kb.Text>
                  <Kb.Text type="BodySmall">
                    You won't be asked for your password when restarting the app or your device.
                  </Kb.Text>
                </Kb.Box2>
              }
              onCheck={onChangeRememberPassword}
            />
          )}
          {isLinux ? <UseNativeFrame /> : null}
          {!Styles.isMobile && (
            <Kb.Checkbox label="Open Keybase on startup" checked={openAtLogin} onCheck={onSetOpenAtLogin} />
          )}
          {!Styles.isMobile && (
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
          style={Styles.collapseStyles([styles.section, {paddingTop: 0}])}
        >
          <ProxySettings />
        </Kb.Box2>
        <Developer />
      </Kb.Box2>
    </Kb.ScrollView>
  )
}

if (isMobile) {
  Advanced.navigationOptions = {
    header: undefined,
    title: 'Advanced',
  }
}

const clickThreshold = 7
const traceDurationSeconds = 30
const processorProfileDurationSeconds = 30

const Developer = () => {
  const dispatch = Container.useDispatch()
  const [clickCount, setClickCount] = React.useState(0)

  const onExtraKBFSLogging = () => dispatch(FSGen.createSetDebugLevel({level: 'vlog2'}))
  const onToggleRuntimeStats = () => dispatch(ConfigGen.createToggleRuntimeStats())
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
  const traceInProgress = Container.useSelector(state => Constants.traceInProgress(state))
  const onTrace = (durationSeconds: number) => dispatch(SettingsGen.createTrace({durationSeconds}))
  const processorProfileInProgress = Container.useSelector(state =>
    Constants.processorProfileInProgress(state)
  )
  const onProcessorProfile = (durationSeconds: number) =>
    dispatch(SettingsGen.createProcessorProfile({durationSeconds}))
  const onDBNuke = () => dispatch(RouteTreeGen.createNavigateAppend({path: ['dbNukeConfirm']}))

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
      {showPprofControls && (
        <>
          <Kb.Button
            label="Toggle Runtime Stats"
            onClick={onToggleRuntimeStats}
            mode="Secondary"
            style={styles.developerButtons}
          />
          <Kb.Button
            label="Toggle Render Stats"
            onClick={toggleRenderDebug}
            mode="Secondary"
            style={styles.developerButtons}
          />

          <Kb.Button
            waiting={traceInProgress}
            style={{marginTop: Styles.globalMargins.small}}
            type="Danger"
            label={`Trace (${traceDurationSeconds}s)`}
            onClick={() => onTrace(traceDurationSeconds)}
          />
          <Kb.Button
            waiting={processorProfileInProgress}
            style={{marginTop: Styles.globalMargins.small}}
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

const styles = Styles.styleSheetCreate(() => ({
  checkboxContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    paddingBottom: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.tiny,
    width: '100%',
  },
  developerButtons: {
    marginTop: Styles.globalMargins.small,
  },
  developerContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    flex: 1,
    paddingBottom: Styles.globalMargins.medium,
  },
  displayInline: Styles.platformStyles({isElectron: {display: 'inline'}}),
  divider: {
    marginTop: Styles.globalMargins.xsmall,
    width: '100%',
  },
  error: {
    color: Styles.globalColors.redDark,
  },
  filler: {
    flex: 1,
  },
  progressContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  proxyDivider: {
    marginBottom: Styles.globalMargins.small,
    marginTop: Styles.globalMargins.small,
    width: '100%',
  },
  scrollview: {
    width: '100%',
  },
  section: Styles.platformStyles({
    common: {
      ...Styles.padding(
        Styles.globalMargins.small,
        Styles.globalMargins.mediumLarge,
        Styles.globalMargins.medium,
        Styles.globalMargins.small
      ),
    },
    isElectron: {
      maxWidth: 600,
    },
  }),
  text: Styles.platformStyles({
    isElectron: {
      cursor: 'default',
    },
  }),
}))

export default Advanced
