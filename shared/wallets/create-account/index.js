// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import type {ValidationState} from '../../constants/types/wallets'
import {EnterNamePopup, WalletPopup} from '../common'
import * as Styles from '../../styles'

type Props = {|
  createNewAccountError: string,
  error: string,
  nameValidationState: ValidationState,
  onBack?: () => void,
  onCancel: () => void,
  onClearErrors: () => void,
  onCreateAccount: (name: string) => void,
  onDone: (name: string) => void,
  waiting: boolean,
|}

type State = {|
  name: string,
|}
class CreateAccount extends React.Component<Props, State> {
  state = {name: ''}
  _onNameChange = name => this.setState({name})
  _onDone = () => this.props.onDone(this.state.name)
  _getBottomButtons = () => [
    ...(Styles.isMobile
      ? []
      : [
          <Kb.Button
            key={0}
            type="Secondary"
            onClick={this.props.onCancel}
            label="Cancel"
            disabled={this.props.waiting}
          />,
        ]),
    <Kb.Button
      key={1}
      type="Wallet"
      onClick={this._onDone}
      label="Done"
      waiting={this.props.waiting}
      fullWidth={Styles.isMobile}
      disabled={!this.state.name}
    />,
  ]

  componentDidMount() {
    this.props.onClearErrors()
  }

  componentWillUnmount() {
    this.props.onClearErrors()
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.nameValidationState === 'valid' && prevProps.nameValidationState !== 'valid') {
      this.props.onClearErrors()
      this.props.onCreateAccount(this.state.name)
      // This is for when we are showing this from a SendForm.
      this.props.onBack && this.props.onBack()
    }
  }

  render() {
    return (
      <WalletPopup
        bottomButtons={this._getBottomButtons()}
        onExit={this.props.onCancel}
        backButtonType="cancel"
        headerTitle="Name account"
      >
        <EnterNamePopup
          error={this.props.error || this.props.createNewAccountError}
          name={this.state.name}
          onNameChange={this._onNameChange}
        />
      </WalletPopup>
    )
  }
}

export default CreateAccount
