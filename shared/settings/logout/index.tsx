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

type State = {
  loggingOut: boolean
  password: string
  showTyping: boolean
}

class LogOut extends React.Component<Props, State> {
  state = {
    loggingOut: false,
    password: '',
    showTyping: false,
  }

  logOut = () => {
    if (this.state.loggingOut) {
      return
    }
    this.props.onLogout()
    this.setState({loggingOut: true})
  }

  componentDidMount() {
    this.props.onBootstrap()
  }

  render() {
    const inputType = this.state.showTyping ? 'text' : 'password'
    const keyboardType = this.state.showTyping && Kb.Styles.isAndroid ? 'visible-password' : 'default'
    return this.props.hasRandomPW === undefined ? (
      <Kb.Modal onClose={this.props.onCancel}>
        <Kb.ProgressIndicator style={styles.progress} type="Huge" />
      </Kb.Modal>
    ) : this.props.hasRandomPW ? (
      <UpdatePassword
        error=""
        onUpdatePGPSettings={this.props.onUpdatePGPSettings}
        hasPGPKeyOnServer={this.props.hasPGPKeyOnServer}
        hasRandomPW={this.props.hasRandomPW}
        onCancel={this.props.onCancel}
        onSave={this.props.onSavePassword}
        saveLabel="Sign out"
        waitingForResponse={this.props.waitingForResponse}
      />
    ) : (
      <Kb.Modal
        backgroundStyle={styles.logoutBackground}
        banners={
          <>
            {this.props.checkPasswordIsCorrect === false ? (
              <Kb.Banner color="red">Wrong password. Please try again.</Kb.Banner>
            ) : null}
            {this.props.checkPasswordIsCorrect === true ? (
              <Kb.Banner color="green">Your password is correct.</Kb.Banner>
            ) : null}
          </>
        }
        footer={{
          content: !this.props.checkPasswordIsCorrect ? (
            <Kb.ButtonBar align="center" direction="column" fullWidth={true} style={styles.buttonBar}>
              <Kb.WaitingButton
                fullWidth={true}
                waitingKey={Constants.checkPasswordWaitingKey}
                disabled={!this.state.password || this.state.loggingOut}
                label="Test password"
                onClick={() => {
                  this.props.onCheckPassword(this.state.password)
                }}
              />
              <Kb.Box2 direction="horizontal">
                {this.state.loggingOut ? (
                  <Kb.ProgressIndicator style={styles.smallProgress} type="Small" />
                ) : (
                  <Kb.ClickableBox
                    onClick={this.logOut}
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
              {this.state.loggingOut ? (
                <Kb.ProgressIndicator style={styles.smallProgress} type="Small" />
              ) : (
                <Kb.Button label="Safely sign out" fullWidth={true} onClick={this.logOut} type="Success" />
              )}
            </Kb.ButtonBar>
          ),
        }}
        header={{
          leftButton: Kb.Styles.isMobile ? (
            <Kb.Text type="BodyBigLink" onClick={this.props.onCancel}>
              Cancel
            </Kb.Text>
          ) : null,
          title: !Kb.Styles.isMobile && 'Do you know your password?',
        }}
        onClose={this.props.onCancel}
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
                this.props.checkPasswordIsCorrect
                  ? this.logOut()
                  : this.props.onCheckPassword(this.state.password)
              }}
              onChangeText={password => this.setState({password})}
              placeholder="Your password"
              type={inputType}
              value={this.state.password}
            />
          </Kb.RoundedBox>
          <Kb.Checkbox
            checked={this.state.showTyping}
            label="Show typing"
            onCheck={() => this.setState(prevState => ({showTyping: !prevState.showTyping}))}
            style={styles.checkbox}
          />
        </Kb.Box2>
      </Kb.Modal>
    )
  }
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
