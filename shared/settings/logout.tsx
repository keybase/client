import * as React from 'react'
import {useSafeSubmit} from '@/util/safe-submit'
import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {UpdatePassword, useSubmitNewPassword} from './password'
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
  const {hasRandomPW, loadHasRandomPw} = usePWState(
    C.useShallow(s => ({
      hasRandomPW: s.randomPW,
      loadHasRandomPw: s.dispatch.loadHasRandomPw,
    }))
  )
  const {error, onSave, waitingForResponse} = useSubmitNewPassword(true)
  const [hasPGPKeyOnServer, setHasPGPKeyOnServer] = React.useState(false)
  const loadPgpSettings = C.useRPC(T.RPCGen.accountHasServerKeysRpcPromise)
  const requestLogout = useLogoutState(s => s.dispatch.requestLogout)

  const onBootstrap = loadHasRandomPw
  const onCheckPassword = checkPassword

  const _onLogout = () => {
    requestLogout()
    resetCheckPassword()
  }

  const onLogout = useSafeSubmit(_onLogout, false)

  const [loggingOut, setLoggingOut] = React.useState(false)
  const [password, setPassword] = React.useState('')
  const [showTyping, setShowTyping] = React.useState(false)

  React.useEffect(() => {
    onBootstrap()
  }, [onBootstrap])

  React.useEffect(() => {
    if (!hasRandomPW) {
      return
    }
    loadPgpSettings(
      [undefined],
      ({hasServerKeys}) => {
        setHasPGPKeyOnServer(hasServerKeys)
      },
      () => {
        setHasPGPKeyOnServer(false)
      }
    )
  }, [hasRandomPW, loadPgpSettings])

  const logOut = () => {
    if (loggingOut) return
    onLogout()
    setLoggingOut(true)
  }

  const keyboardType = showTyping && Kb.Styles.isAndroid ? 'visible-password' : 'default'

  return hasRandomPW === undefined ? (
    <Kb.ProgressIndicator style={styles.progress} type="Huge" />
  ) : hasRandomPW ? (
    <UpdatePassword
      error={error}
      hasPGPKeyOnServer={hasPGPKeyOnServer}
      onSave={onSave}
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
