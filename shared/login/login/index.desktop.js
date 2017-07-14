// @flow
import React, {Component} from 'react'
import {Box, UserCard, Text, Button, FormWithCheckbox, Icon, PopupDialog} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import glamorous from 'glamorous'

import type {Props} from '.'

type State = {
  open: boolean,
}

const ItemBox = glamorous(Box)({
  ...globalStyles.flexBoxCenter,
  ':hover': {
    backgroundColor: globalColors.blue3_40,
  },
  border: `1px solid ${globalColors.lightGrey2}`,
  minHeight: 40,
  width: '100%',
})

const ButtonBox = glamorous(Box)({
  ...globalStyles.flexBoxRow,
  ':hover': {
    border: `solid 1px ${globalColors.blue2}`,
    color: globalColors.blue2,
  },
  alignItems: 'center',
  color: globalColors.lightGrey2,
  border: `solid 1px ${globalColors.lightGrey2}`,
  borderRadius: 100,
  paddingRight: globalMargins.small,
  width: 270,
})

const other = 'Someone else...'

const UserRow = ({user, onClick}) => (
  <ItemBox onClick={onClick}>
    <Text type="Header" style={{color: user === other ? globalColors.black : globalColors.orange}}>
      {user}
    </Text>
  </ItemBox>
)

class Login extends Component<void, Props, State> {
  state = {
    open: false,
  }

  _toggleOpen = () => {
    this.setState({open: !this.state.open})
  }

  render() {
    const inputProps = {
      hintText: 'Passphrase',
      floatingHintTextOverride: '',
      style: {marginBottom: 0},
      onChangeText: passphrase => this.props.passphraseChange(passphrase),
      type: this.props.showTyping ? 'passwordVisible' : 'password',
      onEnterKeyDown: () => this.props.onSubmit(),
      errorText: this.props.error,
      autoFocus: true,
      value: this.props.passphrase,
    }

    const checkboxProps = [
      {
        label: 'Show typing',
        checked: this.props.showTyping,
        onCheck: check => {
          this.props.showTypingChange(check)
        },
      },
    ]

    return (
      <Box style={stylesContainer}>
        <UserCard username={this.props.selectedUser}>
          <ButtonBox onClick={this._toggleOpen}>
            <Button
              type="Primary"
              label={this.props.selectedUser}
              labelStyle={{color: globalColors.orange, fontSize: 16, paddingLeft: 18}}
              style={{backgroundColor: globalColors.white, flex: 1}}
            />
            <Icon type="iconfont-caret-down" inheritColor={true} style={{fontSize: 11}} />
          </ButtonBox>
          {this.state.open &&
            <PopupDialog
              onClose={this._toggleOpen}
              styleCover={{backgroundColor: globalColors.transparent, zIndex: 999}}
              styleClose={{opacity: 0}}
              styleClipContainer={{borderRadius: 0, marginTop: 100}}
            >
              <Box style={{height: '100%', width: '100%'}}>
                <Box
                  style={{
                    ...globalStyles.flexBoxColumn,
                    ...globalStyles.scrollable,
                    border: `1px solid ${globalColors.blue}`,
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
                </Box>
              </Box>
            </PopupDialog>}
          <FormWithCheckbox
            style={{alignSelf: 'stretch'}}
            inputProps={inputProps}
            checkboxesProps={checkboxProps}
          />
          <Button
            waiting={this.props.waitingForResponse}
            style={{marginTop: 0}}
            type="Primary"
            label="Log in"
            onClick={() => this.props.onSubmit()}
          />
          <Text
            link={true}
            type="BodySmallSecondaryLink"
            onClick={this.props.onForgotPassphrase}
            style={{marginTop: 24}}
          >
            Forgot passphrase?
          </Text>
        </UserCard>
        <Text style={{marginTop: 30}} type="BodyPrimaryLink" onClick={this.props.onSignup}>
          Create an account
        </Text>
      </Box>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  backgroundColor: globalColors.white,
}

export default Login
