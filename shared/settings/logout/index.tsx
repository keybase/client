import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Constants from '@/constants/settings'
import UpdatePassword from '../password'

export type Props = {
  checkPasswordIsCorrect?: boolean
  hasPGPKeyOnServer: boolean
  hasRandomPW?: boolean
  onBootstrap: () => void
  onCancel: () => void
  onCheckPassword: (password: string) => void
  onLogout: () => void
  onSavePassword: (password: string) => void
  onUpdatePGPSettings: () => void
  waitingForResponse: boolean
}

const LogOut = (props: Props) => {
  const {onBootstrap} = props
  const [loggingOut, setLoggingOut] = React.useState(false)
  const [password, setPassword] = React.useState('')
  const [showTyping, setShowTyping] = React.useState(false)

  React.useEffect(() => {
    onBootstrap()
  }, [onBootstrap])

  const logOut = () => {
    if (loggingOut) return
    props.onLogout()
    setLoggingOut(true)
  }

  const inputType = showTyping ? 'text' : 'password'
  const keyboardType = showTyping && Kb.Styles.isAndroid ? 'visible-password' : 'default'

  return props.hasRandomPW === undefined ? (
    <Kb.Modal onClose={props.onCancel}>
      <Kb.ProgressIndicator style={styles.progress} type="Huge" />
    </Kb.Modal>
  ) : props.hasRandomPW ? (
    <UpdatePassword
      error=""
      onUpdatePGPSettings={props.onUpdatePGPSettings}
      hasPGPKeyOnServer={props.hasPGPKeyOnServer}
      hasRandomPW={props.hasRandomPW}
      onCancel={props.onCancel}
      onSave={props.onSavePassword}
      saveLabel="Sign out"
      waitingForResponse={props.waitingForResponse}
    />
  ) : (
    <Kb.Modal
      backgroundStyle={styles.logoutBackground}
      banners={
        <>
          {props.checkPasswordIsCorrect === false ? (
            <Kb.Banner color="red">Wrong password. Please try again.</Kb.Banner>
          ) : null}
          {props.checkPasswordIsCorrect === true ? (
            <Kb.Banner color="green">Your password is correct.</Kb.Banner>
          ) : null}
        </>
      }
      footer={{
        content: !props.checkPasswordIsCorrect ? (
          <Kb.ButtonBar align="center" direction="column" fullWidth={true} style={styles.buttonBar}>
            <Kb.WaitingButton
              fullWidth={true}
              waitingKey={Constants.checkPasswordWaitingKey}
              disabled={!password || loggingOut}
              label="Test password"
              onClick={() => props.onCheckPassword(password)}
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
          <Kb.Text type="BodyBigLink" onClick={props.onCancel}>
            Cancel
          </Kb.Text>
        ) : null,
        title: !Kb.Styles.isMobile && 'Do you know your password?',
      }}
      onClose={props.onCancel}
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
              props.checkPasswordIsCorrect ? logOut() : props.onCheckPassword(password)
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
      buttonBar: {
        minHeight: undefined,
      },
      checkbox: {
        paddingTop: Kb.Styles.globalMargins.tiny,
      },
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
      logout: {
        paddingLeft: Kb.Styles.globalMargins.xtiny,
      },
      logoutBackground: Kb.Styles.platformStyles({
        isTablet: {
          backgroundColor: Kb.Styles.globalColors.blueGrey,
        },
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
      smallProgress: {
        alignSelf: 'center',
      },
    }) as const
)

export default LogOut
