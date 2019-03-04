// @flow
import * as React from 'react'
import * as Constants from '../../constants/login'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

import type {Props} from '.'

type State = {
  open: boolean,
}

const ItemBox = Styles.styled(Kb.Box)({
  ...Styles.globalStyles.flexBoxCenter,
  minHeight: 40,
  width: '100%',
})

const other = 'Someone else...'

const UserRow = ({user}) => (
  <ItemBox>
    <Kb.Text
      type="Header"
      style={{color: user === other ? Styles.globalColors.black : Styles.globalColors.orange}}
    >
      {user}
    </Kb.Text>
  </ItemBox>
)

class Login extends React.Component<Props, State> {
  _inputRef: ?HTMLInputElement

  state = {
    open: false,
  }

  _toggleOpen = () => {
    this.setState(prevState => ({open: !prevState.open}))
  }

  _setInputRef = ref => {
    this._inputRef = ref
  }

  _onClickUser = (selected: React.Element<typeof UserRow>) => {
    if (selected.props.user === other) {
      this._toggleOpen()
      this.props.onSomeoneElse()
    } else {
      this._toggleOpen()
      this.props.selectedUserChange(selected.props.user)
      if (this._inputRef) {
        this._inputRef.focus()
      }
    }
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
      ref: this._setInputRef,
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

    const userRows = this.props.users.concat(other).map(u => <UserRow user={u} key={u} />)

    const selectedIdx = this.props.users.indexOf(this.props.selectedUser)

    return (
      <Kb.Box style={stylesContainer}>
        <Kb.UserCard username={this.props.selectedUser}>
          <Kb.Dropdown
            onChanged={this._onClickUser}
            selected={userRows[selectedIdx]}
            items={userRows}
            position={'bottom center'}
          />
          <Kb.FormWithCheckbox
            style={{alignSelf: 'stretch'}}
            inputProps={inputProps}
            checkboxesProps={checkboxProps}
          />
          <Kb.WaitingButton
            disabled={!this.props.passphrase}
            fullWidth={true}
            waitingKey={Constants.waitingKey}
            style={{marginTop: 0, width: '100%'}}
            type="Primary"
            label="Log in"
            onClick={() => this.props.onSubmit()}
          />
          <Kb.Text
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
