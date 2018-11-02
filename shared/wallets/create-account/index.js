// @flow
import * as React from 'react'
import type {ValidationState} from '../../constants/types/wallets'
import {EnterNamePopup} from '../common'

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
      <EnterNamePopup
        error={this.props.error || this.props.createNewAccountError}
        name={this.state.name}
        onBack={this.props.onBack}
        onCancel={this.props.onCancel}
        onNameChange={this._onNameChange}
        onPrimaryClick={this._onDone}
        waiting={this.props.waiting}
      />
    )
  }
}

export default CreateAccount
