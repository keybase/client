import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Constants from '../../constants/settings'
import UpdatePassword from '../../settings/password'

export type Props = {
  checkPasswordIsCorrect: boolean | null
  hasRandomPW: boolean | null
  onBootstrap: () => void
  onCancel: () => void
  onCheckPassword: (password: string) => void
  onLogout: () => void
  onSavePassword: (password: string, passwordConfirm: string) => void
  waitingForResponse: boolean
}

type State = {
  loggingOut: boolean
  password: string
  showTyping: boolean
}

const HoverBox = Styles.isMobile
  ? Kb.ClickableBox
  : Styles.styled(Kb.ClickableBox)({
      ':hover .text': {textDecoration: 'underline'},
    })

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
    const keyboardType = this.state.showTyping && Styles.isAndroid ? 'visible-password' : 'default'
    return this.props.hasRandomPW === null ? (
      <Kb.Modal onClose={this.props.onCancel}>
        <Kb.ProgressIndicator style={styles.progress} type="Huge" />
      </Kb.Modal>
    ) : this.props.hasRandomPW ? (
      <UpdatePassword
        hasRandomPW={this.props.hasRandomPW}
        onCancel={this.props.onCancel}
        onSave={this.props.onSavePassword}
        saveLabel="Sign out"
        waitingForResponse={this.props.waitingForResponse}
      />
    ) : (
      <Kb.Modal
        banners={[
          this.props.checkPasswordIsCorrect === false && (
            <Kb.Banner color="red">Wrong password. Please try again.</Kb.Banner>
          ),
          this.props.checkPasswordIsCorrect === true && (
            <Kb.Banner color="green">Your password is correct.</Kb.Banner>
          ),
        ]}
        footer={{
          content: !this.props.checkPasswordIsCorrect ? (
            <Kb.ButtonBar align="center" direction="column" fullWidth={true} style={styles.buttonBar}>
              <Kb.WaitingButton
                fullWidth={true}
                waitingKey={Constants.checkPasswordWaitingKey}
                disabled={
                  !!this.props.checkPasswordIsCorrect || !this.state.password || this.state.loggingOut
                }
                label="Test password"
                onClick={() => {
                  this.props.onCheckPassword(this.state.password)
                }}
              />
              <Kb.Box2 direction="horizontal">
                {this.state.loggingOut ? (
                  <Kb.ProgressIndicator style={styles.smallProgress} type="Small" />
                ) : (
                  <HoverBox onClick={this.logOut} style={styles.logoutContainer}>
                    <Kb.Icon type="iconfont-leave" />
                    <Kb.Text className="text" style={styles.logout} type="BodySmallSecondaryLink">
                      Just sign out
                    </Kb.Text>
                  </HoverBox>
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
          leftButton: Styles.isMobile ? (
            <Kb.Text type="BodyBigLink" onClick={this.props.onCancel}>
              Cancel
            </Kb.Text>
          ) : null,
          title: !Styles.isMobile && 'Do you know your password?',
        }}
        onClose={this.props.onCancel}
      >
        <Kb.Box2 direction="vertical" fullHeight={true} style={styles.container}>
          {Styles.isMobile && (
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
                this.props.onCheckPassword(this.state.password)
              }}
              onChangeText={password => this.setState({password})}
              placeholder="Your password"
              type={inputType}
              value={this.state.password}
            />
          </Kb.RoundedBox>
          <Kb.Checkbox
            boxBackgroundColor={Styles.globalColors.white}
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

const styles = Styles.styleSheetCreate({
  bodyText: {
    paddingBottom: Styles.globalMargins.tiny,
    textAlign: 'center',
  },
  buttonBar: {
    minHeight: undefined,
  },
  checkbox: {
    paddingTop: Styles.globalMargins.tiny,
  },
  container: {
    ...Styles.padding(
      Styles.globalMargins.medium,
      Styles.globalMargins.small,
      Styles.globalMargins.medium,
      Styles.globalMargins.small
    ),
    backgroundColor: Styles.globalColors.blueGrey,
    flexGrow: 1,
  },
  headerText: {
    marginBottom: Styles.globalMargins.small,
    textAlign: 'center',
  },
  logout: {
    paddingLeft: Styles.globalMargins.xtiny,
  },
  logoutContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      justifyContent: 'center',
      paddingTop: Styles.globalMargins.tiny,
    },
    isElectron: {
      ...Styles.desktopStyles.clickable,
    },
  }),
  progress: {
    alignSelf: 'center',
    marginBottom: Styles.globalMargins.xlarge,
    marginTop: Styles.globalMargins.xlarge,
  },
  smallProgress: {
    alignSelf: 'center',
  },
})

export default LogOut
