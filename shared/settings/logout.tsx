import * as React from 'react'
import {useSafeSubmit} from '@/util/safe-submit'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {UpdatePassword} from './password'
import {useState as useSettingsPasswordState} from '@/constants/settings-password'

const LogoutContainer = () => {
  const checkPasswordIsCorrect = C.useSettingsState(s => s.checkPasswordIsCorrect)
  const resetCheckPassword = C.useSettingsState(s => s.dispatch.resetCheckPassword)
  const checkPassword = C.useSettingsState(s => s.dispatch.checkPassword)
  const hasRandomPW = useSettingsPasswordState(s => s.randomPW)
  const waitingForResponse = C.Waiting.useAnyWaiting(C.Settings.settingsWaitingKey)

  const loadHasRandomPw = useSettingsPasswordState(s => s.dispatch.loadHasRandomPw)

  const onBootstrap = loadHasRandomPw
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = React.useCallback(() => {
    resetCheckPassword()
    navigateUp()
  }, [resetCheckPassword, navigateUp])
  const onCheckPassword = checkPassword

  const requestLogout = C.useLogoutState(s => s.dispatch.requestLogout)

  const _onLogout = React.useCallback(() => {
    requestLogout()
    resetCheckPassword()
  }, [resetCheckPassword, requestLogout])

  const submitNewPassword = useSettingsPasswordState(s => s.dispatch.submitNewPassword)
  const _setPassword = useSettingsPasswordState(s => s.dispatch.setPassword)
  const setPasswordConfirm = useSettingsPasswordState(s => s.dispatch.setPasswordConfirm)

  const onSavePassword = React.useCallback(
    (password: string) => {
      _setPassword(password)
      setPasswordConfirm(password)
      submitNewPassword(true)
    },
    [submitNewPassword, _setPassword, setPasswordConfirm]
  )

  const onLogout = useSafeSubmit(_onLogout, false)

  const onUpdatePGPSettings = useSettingsPasswordState(s => s.dispatch.loadPgpSettings)
  const hasPGPKeyOnServer = useSettingsPasswordState(s => !!s.hasPGPKeyOnServer)

  const [loggingOut, setLoggingOut] = React.useState(false)
  const [password, setPassword] = React.useState('')
  const [showTyping, setShowTyping] = React.useState(false)

  React.useEffect(() => {
    onBootstrap()
  }, [onBootstrap])

  const logOut = () => {
    if (loggingOut) return
    onLogout()
    setLoggingOut(true)
  }

  const inputType = showTyping ? 'text' : 'password'
  const keyboardType = showTyping && Kb.Styles.isAndroid ? 'visible-password' : 'default'

  return hasRandomPW === undefined ? (
    <Kb.Modal onClose={onCancel}>
      <Kb.ProgressIndicator style={styles.progress} type="Huge" />
    </Kb.Modal>
  ) : hasRandomPW ? (
    <UpdatePassword
      error=""
      onUpdatePGPSettings={onUpdatePGPSettings}
      hasPGPKeyOnServer={hasPGPKeyOnServer}
      hasRandomPW={hasRandomPW}
      onCancel={onCancel}
      onSave={onSavePassword}
      saveLabel="Sign out"
      waitingForResponse={waitingForResponse}
    />
  ) : (
    <Kb.Modal
      backgroundStyle={styles.logoutBackground}
      banners={
        <>
          {checkPasswordIsCorrect === false ? (
            <Kb.Banner color="red">Wrong password. Please try again.</Kb.Banner>
          ) : null}
          {checkPasswordIsCorrect === true ? (
            <Kb.Banner color="green">Your password is correct.</Kb.Banner>
          ) : null}
        </>
      }
      footer={{
        content: !checkPasswordIsCorrect ? (
          <Kb.ButtonBar align="center" direction="column" fullWidth={true} style={styles.buttonBar}>
            <Kb.WaitingButton
              fullWidth={true}
              waitingKey={C.Settings.checkPasswordWaitingKey}
              disabled={!password || loggingOut}
              label="Test password"
              onClick={() => onCheckPassword(password)}
            />
            <Kb.Box2 direction="horizontal">
              {loggingOut ? (
                <Kb.ProgressIndicator style={styles.smallProgress} type="Small" />
              ) : (
                <Kb.ClickableBox
                  onClick={logOut}
                  style={styles.logoutContainer}
                  className="hover-underline-container"
                >
                  <Kb.Icon type="iconfont-leave" />
                  <Kb.Text className="underline" style={styles.logout} type="BodySmallSecondaryLink">
                    Just sign out
                  </Kb.Text>
                </Kb.ClickableBox>
              )}
            </Kb.Box2>
          </Kb.ButtonBar>
        ) : (
          <Kb.ButtonBar align="center" direction="row" fullWidth={true} style={styles.buttonBar}>
            {loggingOut ? (
              <Kb.ProgressIndicator style={styles.smallProgress} type="Small" />
            ) : (
              <Kb.Button label="Safely sign out" fullWidth={true} onClick={logOut} type="Success" />
            )}
          </Kb.ButtonBar>
        ),
      }}
      header={{
        leftButton: Kb.Styles.isMobile ? (
          <Kb.Text type="BodyBigLink" onClick={onCancel}>
            Cancel
          </Kb.Text>
        ) : null,
        title: !Kb.Styles.isMobile && 'Do you know your password?',
      }}
      onClose={onCancel}
    >
      <Kb.Box2 direction="vertical" fullHeight={true} style={styles.container}>
        {Kb.Styles.isMobile && (
          <Kb.Text style={styles.headerText} type="Header">
            Do you know your password?
          </Kb.Text>
        )}
        <Kb.Text style={styles.bodyText} type="Body">
          You will need it to sign back in.
        </Kb.Text>
        <Kb.RoundedBox>
          <Kb.PlainInput
            keyboardType={keyboardType}
            onEnterKeyDown={() => {
              checkPasswordIsCorrect ? logOut() : onCheckPassword(password)
            }}
            onChangeText={setPassword}
            placeholder="Your password"
            type={inputType}
            value={password}
          />
        </Kb.RoundedBox>
        <Kb.Checkbox
          checked={showTyping}
          label="Show typing"
          onCheck={() => setShowTyping(!showTyping)}
          style={styles.checkbox}
        />
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      bodyText: {
        paddingBottom: Kb.Styles.globalMargins.tiny,
        textAlign: 'center',
      },
      buttonBar: {minHeight: undefined},
      checkbox: {paddingTop: Kb.Styles.globalMargins.tiny},
      container: {
        ...Kb.Styles.padding(
          Kb.Styles.globalMargins.medium,
          Kb.Styles.globalMargins.small,
          Kb.Styles.globalMargins.medium,
          Kb.Styles.globalMargins.small
        ),
        backgroundColor: Kb.Styles.globalColors.blueGrey,
        flexGrow: 1,
      },
      headerText: {
        marginBottom: Kb.Styles.globalMargins.small,
        textAlign: 'center',
      },
      logout: {paddingLeft: Kb.Styles.globalMargins.xtiny},
      logoutBackground: Kb.Styles.platformStyles({
        isTablet: {backgroundColor: Kb.Styles.globalColors.blueGrey},
      }),
      logoutContainer: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.flexBoxRow,
          justifyContent: 'center',
          paddingTop: Kb.Styles.globalMargins.tiny,
        },
        isElectron: {
          ...Kb.Styles.desktopStyles.clickable,
        },
      }),
      progress: {
        alignSelf: 'center',
        marginBottom: Kb.Styles.globalMargins.xlarge,
        marginTop: Kb.Styles.globalMargins.xlarge,
      },
      smallProgress: {alignSelf: 'center'},
    }) as const
)

export default LogoutContainer
