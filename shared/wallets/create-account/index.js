// @flow
import * as React from 'react'
import type {ValidationState} from '../../constants/types/wallets'
import {EnterNamePopup} from '../common'

type Props = {|
  createNewAccountError: string,
  error: string,
  name: string,
  nameValidationState: ValidationState,
  onBack?: () => void,
  onCancel: () => void,
  onClearErrors: () => void,
  onCreateAccount: () => void,
  onDone: () => void,
  onNameChange: string => void,
  waiting: boolean,
|}

class CreateAccount extends React.Component<Props> {
  render() {
    return (
      <EnterNamePopup
        error={this.props.error || this.props.createNewAccountError}
        name={this.props.name}
        onBack={this.props.onBack}
        onCancel={this.props.onCancel}
        onNameChange={this.props.onNameChange}
        onPrimaryClick={this.props.onDone}
        waiting={this.props.waiting}
      />
    )
  }

  componentDidMount() {
    this.props.onClearErrors()
  }
  componentWillUnmount() {
    this.props.onClearErrors()
  }
  componentDidUpdate(prevProps: Props) {
    if (this.props.nameValidationState === 'valid' && prevProps.nameValidationState !== 'valid') {
      this.props.onClearErrors()
      this.props.onCreateAccount()
      // This is for when we are showing this from a SendForm.
      //
      // songgao: Note that we are switching back to the root of SendForm
      // before we have finished creating the account, but the critical point
      // is in Saga and it doesn't seem like a good idea to plumb onBack into
      // Saga.
      this.props.onBack && this.props.onBack()
    }
  }
}

export default CreateAccount
