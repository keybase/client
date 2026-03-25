import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {UpdatePassword} from './password'
import {usePWState} from '@/stores/settings-password'
import {useSettingsState} from '@/stores/settings'
import {useLogoutState} from '@/stores/logout'

const LogoutContainer = () => {
  const {checkPassword, checkPasswordIsCorrect, resetCheckPassword} = useSettingsState(
    C.useShallow(s => ({
      checkPassword: s.dispatch.checkPassword,
      checkPasswordIsCorrect: s.checkPasswordIsCorrect,
      resetCheckPassword: s.dispatch.resetCheckPassword,
    }))
  )
  const pwState = usePWState(
    C.useShallow(s => ({
      _setPassword: s.dispatch.setPassword,
      hasPGPKeyOnServer: !!s.hasPGPKeyOnServer,
      hasRandomPW: s.randomPW,
      loadHasRandomPw: s.dispatch.loadHasRandomPw,
      onUpdatePGPSettings: s.dispatch.loadPgpSettings,
      setPasswordConfirm: s.dispatch.setPasswordConfirm,
      submitNewPassword: s.dispatch.submitNewPassword,
    }))
  )
  const {hasPGPKeyOnServer, hasRandomPW, loadHasRandomPw, onUpdatePGPSettings} = pwState
  const {setPasswordConfirm, submitNewPassword, _setPassword} = pwState
  const waitingForResponse = C.Waiting.useAnyWaiting(C.waitingKeySettingsGeneric)

  const onBootstrap = loadHasRandomPw
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    resetCheckPassword()
    navigateUp()
  }
  const onCheckPassword = checkPassword

  const requestLogout = useLogoutState(s => s.dispatch.requestLogout)

  const _onLogout = () => {
    requestLogout()
    resetCheckPassword()
  }

  const onSavePassword = (password: string) => {
    _setPassword(password)
    setPasswordConfirm(password)
    submitNewPassword(true)
  }

  const [loggingOut, setLoggingOut] = React.useState(false)
  const [password, setPassword] = React.useState('')
  const [showTyping, setShowTyping] = React.useState(false)

  React.useEffect(() => {
    onBootstrap()
  }, [onBootstrap])

  const logOut = () => {
    if (loggingOut) return
    _onLogout()
    setLoggingOut(true)
  }

  const keyboardType = showTyping && Kb.Styles.isAndroid ? 'visible-password' : 'default'

  return hasRandomPW === undefined ? (
    <Kb.ProgressIndicator style={styles.progress} type="Huge" />
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
    <>
      {checkPasswordIsCorrect === false ? (
        <Kb.Banner color="red">Wrong password. Please try again.</Kb.Banner>
      ) : null}
      {checkPasswordIsCorrect === true ? (
        <Kb.Banner color="green">Your password is correct.</Kb.Banner>
      ) : null}
      <Kb.ScrollView alwaysBounceVertical={false} style={Kb.Styles.globalStyles.flexOne}>
        <Kb.Box2 direction="vertical" fullHeight={true} flex={1} style={styles.container}>
          {Kb.Styles.isMobile && (
            <Kb.Text style={styles.headerText} type="Header">
              Do you know your password?
            </Kb.Text>
          )}
          <Kb.Text style={styles.bodyText} type="Body">
            You will need it to sign back in.
          </Kb.Text>
          <Kb.RoundedBox>
            <Kb.Input3
              keyboardType={keyboardType}
              onEnterKeyDown={() => {
                checkPasswordIsCorrect ? logOut() : onCheckPassword(password)
              }}
              onChangeText={setPassword}
              placeholder="Your password"
              secureTextEntry={!showTyping}
              value={password}
              hideBorder={true}
            />
          </Kb.RoundedBox>
          <Kb.Checkbox
            checked={showTyping}
            label="Show typing"
            onCheck={() => setShowTyping(!showTyping)}
            style={styles.checkbox}
          />
        </Kb.Box2>
      </Kb.ScrollView>
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.modalFooter}>
        {!checkPasswordIsCorrect ? (
          <Kb.ButtonBar align="center" direction="column" fullWidth={true} style={styles.buttonBar}>
            <Kb.WaitingButton
              fullWidth={true}
              waitingKey={C.waitingKeySettingsCheckPassword}
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
        )}
      </Kb.Box2>
    </>
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
      },
      headerText: {
        marginBottom: Kb.Styles.globalMargins.small,
        textAlign: 'center',
      },
      logout: {paddingLeft: Kb.Styles.globalMargins.xtiny},
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
      modalFooter: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
          borderStyle: 'solid' as const,
          borderTopColor: Kb.Styles.globalColors.black_10,
          borderTopWidth: 1,
          minHeight: 56,
        },
        isElectron: {
          borderBottomLeftRadius: Kb.Styles.borderRadius,
          borderBottomRightRadius: Kb.Styles.borderRadius,
          overflow: 'hidden',
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
