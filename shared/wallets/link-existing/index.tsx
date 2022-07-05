import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import EnterKey from './enter-key'
import {EnterName, WalletPopup} from '../common'
import {ValidationState} from '../../constants/types/wallets'
import {isLargeScreen} from '../../constants/platform'

type View = 'key' | 'name'

type LinkWalletProps = {
  secretKey: string
  linkExistingAccountError: string
  onCancel: () => void
  onCheckKey: (key: string) => void
  onCheckName: (name: string) => void
  onClearErrors: () => void
  onDone: () => void
  onNameChange: (name: string) => void
  onKeyChange: (key: string) => void
  keyError: string
  name: string
  nameError: string
  nameValidationState: ValidationState
  secretKeyValidationState: ValidationState
  view?: View
  waiting: boolean
}

type LinkWalletState = {
  view: View
}

class LinkWallet extends React.Component<LinkWalletProps, LinkWalletState> {
  state = {view: this.props.view || 'key'}
  _onViewChange = (view: View) => this.setState(s => (s.view !== view ? {view} : null))

  _onCheckKey = () => {
    this.props.onCheckKey(this.props.secretKey)
  }

  _onCheckName = () => {
    this.props.onCheckName(this.props.name)
  }

  _getKeyButtons = () => [
    ...(Styles.isMobile
      ? []
      : [<Kb.Button key={0} type="Dim" onClick={this.props.onCancel} label="Cancel" />]),
    <Kb.Button
      key={1}
      disabled={!this.props.secretKey}
      type="Wallet"
      onClick={this._onCheckKey}
      fullWidth={Styles.isMobile}
      label="Next"
      waiting={this.props.secretKeyValidationState === 'waiting' || this.props.waiting}
    />,
  ]

  _getNameButtons = () => [
    ...(Styles.isMobile
      ? []
      : [
          <Kb.Button
            key={0}
            type="Dim"
            onClick={this.props.onCancel}
            label="Cancel"
            disabled={this.props.nameValidationState === 'waiting' || this.props.waiting}
          />,
        ]),
    <Kb.Button
      key={1}
      type="Wallet"
      onClick={this._onCheckName}
      fullWidth={Styles.isMobile}
      label="Done"
      waiting={this.props.nameValidationState === 'waiting' || this.props.waiting}
      disabled={!this.props.name}
    />,
  ]

  _getBottomButtons = () => (this.state.view === 'key' ? this._getKeyButtons() : this._getNameButtons())

  componentDidMount() {
    this.props.onClearErrors()
  }
  componentWillUnmount() {
    this.props.onClearErrors()
  }
  componentDidUpdate() {
    if (this.props.secretKeyValidationState === 'valid' && this.state.view === 'key') {
      this.props.onClearErrors()
      this._onViewChange('name')
    }
    if (this.props.nameValidationState === 'valid' && this.state.view === 'name') {
      this.props.onClearErrors()
      this.props.onDone()
    }
  }

  render() {
    let content: React.ReactNode = null
    switch (this.state.view) {
      case 'key':
        content = (
          <EnterKey
            error={this.props.keyError || this.props.linkExistingAccountError}
            secretKey={this.props.secretKey}
            onKeyChange={this.props.onKeyChange}
          />
        )
        break
      case 'name':
        content = (
          <EnterName
            error={this.props.nameError || this.props.linkExistingAccountError}
            name={this.props.name}
            onNameChange={this.props.onNameChange}
          />
        )
        break
      default:
        throw new Error('LinkExistingWallet: Unexpected value for `view` encountered: ' + this.state.view)
    }
    return (
      <WalletPopup
        bottomButtons={this._getBottomButtons()}
        onCancel={this.props.onCancel}
        onExit={this.state.view === 'name' ? () => this._onViewChange('key') : this.props.onCancel}
        backButtonType={this.state.view === 'name' ? 'back' : 'cancel'}
        headerTitle={isLargeScreen ? 'Link an existing account' : 'Link account'}
      >
        {content}
      </WalletPopup>
    )
  }
}

type WrapperProps = {
  linkExistingAccountError: string
  onCancel: () => void
  onCheckKey: (key: string) => void
  onCheckName: (name: string) => void
  onClearErrors: () => void
  onDone: (secretKey: string, name: string) => void
  keyError: string
  nameError: string
  nameValidationState: ValidationState
  secretKeyValidationState: ValidationState
  waiting: boolean
}

type WrapperState = {
  secretKey: string
  name: string
}

class Wrapper extends React.Component<WrapperProps, WrapperState> {
  state = {name: '', secretKey: ''}
  _onKeyChange = (secretKey: string) => this.setState({secretKey})
  _onNameChange = (name: string) => this.setState({name})
  _onDone = () => this.props.onDone(this.state.secretKey, this.state.name)
  render() {
    return (
      <LinkWallet
        {...this.state}
        linkExistingAccountError={this.props.linkExistingAccountError}
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
