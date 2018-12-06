// @flow
import * as React from 'react'
import * as Constants from '../../constants/login'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

import type {Props} from '.'

type State = {
  open: boolean,
}

const ItemBox = Styles.glamorous(Kb.Box)({
  ...Styles.globalStyles.flexBoxCenter,
  ':hover': {
    backgroundColor: Styles.globalColors.blue3_40,
  },
  borderBottom: `1px solid ${Styles.globalColors.lightGrey2}`,
  minHeight: 40,
  width: '100%',
})

const ButtonBox = Styles.glamorous(Kb.Box)({
  ...Styles.globalStyles.flexBoxRow,
  ':hover': {
    border: `solid 1px ${Styles.globalColors.blue2}`,
    color: Styles.globalColors.blue2,
  },
  alignItems: 'center',
  border: `solid 1px ${Styles.globalColors.lightGrey2}`,
  borderRadius: Styles.borderRadius,
  color: Styles.globalColors.lightGrey2,
  paddingRight: Styles.globalMargins.small,
  width: 270,
})

const other = 'Someone else...'

const UserRow = ({user, onClick}) => (
  <ItemBox onClick={onClick}>
    <Kb.Text
      type="Header"
      style={{color: user === other ? Styles.globalColors.black_75 : Styles.globalColors.orange}}
    >
      {user}
    </Kb.Text>
  </ItemBox>
)

class Login extends React.Component<Props, State> {
  state = {
    open: false,
  }

  _toggleOpen = () => {
    this.setState(prevState => ({open: !prevState.open}))
  }

  render() {
    const inputProps = {
      autoFocus: true,
      errorText: this.props.error,
      floatingHintTextOverride: '',
      hintText: 'Passphrase',
      key: this.props.inputKey,
      onChangeText: passphrase => this.props.passphraseChange(passphrase),
      onEnterKeyDown: () => this.props.onSubmit(),
      type: this.props.showTyping ? 'passwordVisible' : 'password',
      uncontrolled: true,
    }

    const checkboxProps = [
      {
        checked: this.props.showTyping,
        label: 'Show typing',
        onCheck: check => {
          this.props.showTypingChange(check)
        },
      },
    ]

    return (
      <Kb.Box style={stylesContainer}>
        <Kb.UserCard username={this.props.selectedUser}>
          <ButtonBox onClick={this._toggleOpen}>
            <Kb.Button
              type="Primary"
              label={this.props.selectedUser}
              labelStyle={{color: Styles.globalColors.orange, fontSize: 16, paddingLeft: 18}}
              onClick={() => {
                /* handled by the ButtonBox */
              }}
              style={{backgroundColor: Styles.globalColors.transparent, flex: 1}}
            />
            <Kb.Icon
              type="iconfont-caret-down"
              color={Styles.globalColors.black_40}
              style={{marginBottom: 4}}
            />
          </ButtonBox>
          {this.state.open && (
            <Kb.PopupDialog
              onClose={this._toggleOpen}
              styleCover={{backgroundColor: Styles.globalColors.transparent, zIndex: 999}}
              styleClose={{opacity: 0}}
              styleClipContainer={{borderRadius: 0, marginTop: 100}}
            >
              <Kb.Box style={{height: '100%', width: '100%'}}>
                <Kb.Box
                  style={{
                    ...Styles.globalStyles.flexBoxColumn,
                    ...Styles.desktopStyles.scrollable,
                    border: `1px solid ${Styles.globalColors.blue}`,
                    borderRadius: 4,
                    maxHeight: 300,
                    width: 270,
                  }}
                >
                  {this.props.users.concat(other).map(u => (
                    <UserRow
                      user={u}
                      key={u}
                      onClick={() => {
                        if (u === other) {
                          this._toggleOpen()
                          this.props.onSomeoneElse()
                        } else {
                          this._toggleOpen()
                          this.props.selectedUserChange(u)
                        }
                      }}
                    />
                  ))}
                </Kb.Box>
              </Kb.Box>
            </Kb.PopupDialog>
          )}
          <Kb.FormWithCheckbox
            style={{alignSelf: 'stretch'}}
            inputProps={inputProps}
            checkboxesProps={checkboxProps}
          />
          <Kb.WaitingButton
            waitingKey={Constants.waitingKey}
            style={{marginTop: 0}}
            type="Primary"
            label="Log in"
            onClick={() => this.props.onSubmit()}
          />
          <Kb.Text
            link={true}
            type="BodySmallSecondaryLink"
            onClick={this.props.onForgotPassphrase}
            style={{marginTop: 24}}
          >
            Forgot passphrase?
          </Kb.Text>
        </Kb.UserCard>
        <Kb.Text style={{marginTop: 30}} type="BodyPrimaryLink" onClick={this.props.onSignup}>
          Create an account
        </Kb.Text>
      </Kb.Box>
    )
  }
}

const stylesContainer = {
  ...Styles.globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: Styles.globalColors.white,
  flex: 1,
  justifyContent: 'center',
}

export default Login
