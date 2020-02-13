import * as ConfigGen from '../actions/config-gen'
import * as Constants from '../constants/settings'
import * as Container from '../util/container'
import * as FSGen from '../actions/fs-gen'
import * as Kb from '../common-adapters'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as SettingsGen from '../actions/settings-gen'
import * as Styles from '../styles'
import flags from '../util/feature-flags'
import {ProxySettings} from './proxy/container'
import {anyErrors, anyWaiting} from '../constants/waiting'
import {isMobile, isLinux, isWindows} from '../constants/platform'

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
      <Kb.Box style={styles.checkboxContainer}>
        <Kb.Checkbox
          checked={!useNativeFrame}
          label="Hide system window frame"
          onCheck={x => onChangeUseNativeFrame(!x)}
        />
      </Kb.Box>
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

  React.useEffect(() => {
    dispatch(SettingsGen.createLoadHasRandomPw())
    dispatch(SettingsGen.createLoadLockdownMode())
    ;(isLinux || isWindows) && dispatch(ConfigGen.createLoadOnLoginStartup())
    dispatch(SettingsGen.createLoadRememberPassword())
  }, [dispatch])

  return (
    <Kb.ScrollView style={styles.scrollview}>
      <Kb.Box style={styles.advancedContainer}>
        {settingLockdownMode && (
          <Kb.Box style={styles.progressContainer}>
            <Kb.ProgressIndicator />
          </Kb.Box>
        )}
        <Kb.Box style={styles.checkboxContainer}>
          <LockdownCheckbox hasRandomPW={hasRandomPW} settingLockdownMode={settingLockdownMode} />
        </Kb.Box>
        {!!setLockdownModeError && (
          <Kb.Text type="BodySmall" style={styles.error}>
            {setLockdownModeError}
          </Kb.Text>
        )}
        {!hasRandomPW && (
          <Kb.Box style={styles.checkboxContainer}>
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
          </Kb.Box>
        )}
        {isLinux ? <UseNativeFrame /> : null}
        {!Styles.isMobile && (
          <Kb.Box style={styles.checkboxContainer}>
            <Kb.Checkbox label="Open Keybase on startup" checked={openAtLogin} onCheck={onSetOpenAtLogin} />
          </Kb.Box>
        )}
        <Kb.Divider style={styles.proxyDivider} />
        <ProxySettings />
        <Developer />
      </Kb.Box>
    </Kb.ScrollView>
  )
}

if (isMobile) {
  Advanced.navigationOptions = {}
}

const clickThreshold = 7
const traceDurationSeconds = 30
const processorProfileDurationSeconds = 30

const Developer = () => {
  const dispatch = Container.useDispatch()
  const [cleanTook, setCleanTook] = React.useState(-1)
  const [clickCount, setClickCount] = React.useState(0)
  const [indexTook, setIndexTook] = React.useState(-1)

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
      {flags.chatIndexProfilingEnabled && (
        <Kb.Button
          label={`Chat Index: ${indexTook}ms`}
          onClick={() => {
            setIndexTook(-1)
            const start = Date.now()
            RPCChatTypes.localProfileChatSearchRpcPromise({
              identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
            }).then(() => setIndexTook(Date.now() - start))
          }}
          mode="Secondary"
          style={styles.developerButtons}
        />
      )}
      {flags.dbCleanEnabled && (
        <Kb.Button
          label={`DB clean: ${cleanTook}ms`}
          onClick={() => {
            setCleanTook(-1)
            const start = Date.now()
            RPCTypes.ctlDbCleanRpcPromise({
              dbType: RPCTypes.DbType.main, // core db
              force: true,
            }).then(() => setCleanTook(Date.now() - start))
          }}
          mode="Secondary"
          style={styles.developerButtons}
        />
      )}
      <Kb.Box style={styles.filler} />
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  advancedContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    flex: 1,
    width: '100%',
  },
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
    paddingTop: Styles.globalMargins.xlarge,
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
    ...Styles.padding(0, Styles.globalMargins.small),
    width: '100%',
  },
  text: Styles.platformStyles({
    isElectron: {
      cursor: 'default',
    },
  }),
}))

export default Advanced
