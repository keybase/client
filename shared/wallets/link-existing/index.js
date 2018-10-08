// @flow
import * as React from 'react'
import EnterKeyPopup from './enter-key-popup'
import {EnterNamePopup} from '../common'
import type {ValidationState} from '../../constants/types/wallets'

type View = 'key' | 'name'

type LinkWalletProps = {|
  secretKey: string,
  linkExistingAccountError: string,
  onBack?: () => void,
  onCancel: () => void,
  onCheckKey: (key: string) => void,
  onCheckName: (name: string) => void,
  onClearErrors: () => void,
  onDone: () => void,
  onNameChange: string => void,
  onKeyChange: string => void,
  keyError: string,
  name: string,
  nameError: string,
  nameValidationState: ValidationState,
  secretKeyValidationState: ValidationState,
  view?: View,
  waiting: boolean,
|}

type LinkWalletState = {|
  view: View,
|}

class LinkWallet extends React.Component<LinkWalletProps, LinkWalletState> {
  state = {view: this.props.view || 'key'}
  _onViewChange = (view: View) => this.setState(s => (s.view !== view ? {view} : null))

  _onCheckKey = () => {
    this.props.onCheckKey(this.props.secretKey)
  }

  _onCheckName = () => {
    this.props.onCheckName(this.props.name)
  }

  componentDidMount() {
    this.props.onClearErrors()
  }
  componentWillUnmount() {
    this.props.onClearErrors()
  }
  componentDidUpdate(prevProps: LinkWalletProps, prevState: LinkWalletState) {
    if (this.props.secretKeyValidationState === 'valid' && this.state.view === 'key') {
      this.props.onClearErrors()
      this._onViewChange('name')
    }
    if (this.props.nameValidationState === 'valid' && this.state.view === 'name') {
      this.props.onClearErrors()
      this.props.onDone()
      // This is for when we are showing this from a SendForm.
      this.props.onBack && this.props.onBack()
    }
  }

  render() {
    switch (this.state.view) {
      case 'key':
        return (
          <EnterKeyPopup
            error={this.props.keyError || this.props.linkExistingAccountError}
            secretKey={this.props.secretKey}
            onCancel={this.props.onCancel}
            onKeyChange={this.props.onKeyChange}
            onNext={this._onCheckKey}
            waiting={this.props.secretKeyValidationState === 'waiting' || this.props.waiting}
            onBack={this.props.onBack}
          />
        )
      case 'name':
        return (
          <EnterNamePopup
            error={this.props.nameError || this.props.linkExistingAccountError}
            name={this.props.name}
            onBack={() => this._onViewChange('key')}
            onCancel={this.props.onCancel}
            onNameChange={this.props.onNameChange}
            onPrimaryClick={this._onCheckName}
            waiting={this.props.nameValidationState === 'waiting' || this.props.waiting}
          />
        )
      default:
        /*::
        declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (view: empty) => any
        ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(this.state.view);
        */
        throw new Error('LinkExistingWallet: Unexpected value for `view` encountered: ' + this.state.view)
    }
  }
}

type WrapperProps = {|
  linkExistingAccountError: string,
  onBack?: () => void,
  onCancel: () => void,
  onCheckKey: (key: string) => void,
  onCheckName: (name: string) => void,
  onClearErrors: () => void,
  onDone: (secretKey: string, name: string) => void,
  keyError: string,
  nameError: string,
  nameValidationState: ValidationState,
  secretKeyValidationState: ValidationState,
  waiting: boolean,
|}

type WrapperState = {|
  secretKey: string,
  name: string,
|}

class Wrapper extends React.Component<WrapperProps, WrapperState> {
  state = {secretKey: '', name: ''}
  _onKeyChange = (secretKey: string) => this.setState({secretKey})
  _onNameChange = (name: string) => this.setState({name})
  _onDone = () => this.props.onDone(this.state.secretKey, this.state.name)
  render() {
    return (
      <LinkWallet
        {...this.state}
        linkExistingAccountError={this.props.linkExistingAccountError}
        onBack={this.props.onBack}
        onCancel={this.props.onCancel}
        onCheckKey={this.props.onCheckKey}
        onCheckName={this.props.onCheckName}
        onClearErrors={this.props.onClearErrors}
        onDone={this._onDone}
        onKeyChange={this._onKeyChange}
        onNameChange={this._onNameChange}
        keyError={this.props.keyError}
        nameError={this.props.nameError}
        nameValidationState={this.props.nameValidationState}
        secretKeyValidationState={this.props.secretKeyValidationState}
        waiting={this.props.waiting}
      />
    )
  }
}

export {Wrapper}
export default LinkWallet
