import * as React from 'react'
import {useSafeSubmit} from '@/util/safe-submit'
import {useNavigation} from '@react-navigation/native'
import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {UpdatePassword, useSubmitNewPassword} from './password'
import {useRequestLogout} from './use-request-logout'
import {usePasswordCheck} from './use-password-check'
import {useRandomPWState} from './use-random-pw'

const LogoutContainer = () => {
  const styles = useStyles()
  const {checkPassword, checkPasswordIsCorrect, reset} = usePasswordCheck()
  const {randomPW: hasRandomPW} = useRandomPWState()
  const {error, onSave, waitingForResponse} = useSubmitNewPassword(true)
  const [hasPGPKeyOnServer, setHasPGPKeyOnServer] = React.useState<boolean | undefined>(undefined)
  const loadPgpSettings = C.useRPC(T.RPCGen.accountHasServerKeysRpcPromise)
  const requestLogout = useRequestLogout()
  const onCheckPassword = checkPassword

  const _onLogout = () => {
    requestLogout()
    reset()
  }

  const onLogout = useSafeSubmit(_onLogout, false)

  const [loggingOut, setLoggingOut] = React.useState(false)
  const [password, setPassword] = React.useState('')
  const [showTyping, setShowTyping] = React.useState(false)

  React.useEffect(
    () => () => {
      reset()
    },
    [reset]
  )

  React.useEffect(() => {
    if (!hasRandomPW) {
      return
    }
    loadPgpSettings(
      [undefined],
      ({hasServerKeys}) => {
        setHasPGPKeyOnServer(hasServerKeys)
      },
      () => {}
    )
  }, [hasRandomPW, loadPgpSettings])

  const logOut = () => {
    if (loggingOut) return
    onLogout()
    setLoggingOut(true)
  }

  const keyboardType = showTyping && isAndroid ? 'visible-password' : 'default'

  const navigation = useNavigation()
  React.useEffect(() => {
    if (hasRandomPW) {
      navigation.setOptions({title: 'Set a password'})
    }
  }, [navigation, hasRandomPW])

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
    <Kb.ModalScreen
      padding="none"
      banner={
        checkPasswordIsCorrect === false ? (
          <Kb.Banner color="red">Wrong password. Please try again.</Kb.Banner>
        ) : checkPasswordIsCorrect === true ? (
          <Kb.Banner color="green">Your password is correct.</Kb.Banner>
        ) : null
      }
      footer={
        !checkPasswordIsCorrect ? (
          <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
            <Kb.WaitingButton
              fullWidth={true}
              waitingKey={C.waitingKeySettingsCheckPassword}
              disabled={!password || loggingOut}
              label="Test password"
              onClick={() => onCheckPassword(password)}
            />
            <Kb.Box2 alignSelf="center" direction="horizontal">
              {loggingOut ? (
                <Kb.ProgressIndicator style={styles.smallProgress} type="Small" />
              ) : (
                <Kb.ClickableBox
                  onClick={logOut}
                  direction="horizontal"
                  justifyContent="center"
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
          </Kb.Box2>
        ) : loggingOut ? (
          <Kb.ProgressIndicator style={styles.smallProgress} type="Small" />
        ) : (
          <Kb.Button label="Safely sign out" fullWidth={true} onClick={logOut} type="Success" />
        )
      }
    >
      <Kb.Box2 direction="vertical" fullWidth={true} flex={1} style={styles.container}>
        <Kb.Text style={styles.bodyText} type="Body">
          You will need it to sign back in.
        </Kb.Text>
        <Kb.RoundedBox>
          <Kb.Input3
            keyboardType={keyboardType}
            onEnterKeyDown={() => {
              if (checkPasswordIsCorrect) {
                logOut()
              } else {
                onCheckPassword(password)
              }
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
    </Kb.ModalScreen>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      bodyText: {
        paddingBottom: Kb.Styles.globalMargins.tiny,
        textAlign: 'center',
      },
      checkbox: {paddingTop: Kb.Styles.globalMargins.tiny},
      container: {
        ...Kb.Styles.padding(Kb.Styles.globalMargins.medium, Kb.Styles.globalMargins.small),
        backgroundColor: theme.blueGrey,
      },
      logout: {paddingLeft: Kb.Styles.globalMargins.xtiny},
      logoutContainer: Kb.Styles.platformStyles({
        common: {
          paddingTop: Kb.Styles.globalMargins.tiny,
        },
      }),
      progress: {
        alignSelf: 'center',
        ...Kb.Styles.marginV(Kb.Styles.globalMargins.xlarge),
      },
      smallProgress: {alignSelf: 'center'},
    }) as const
)

export default LogoutContainer
