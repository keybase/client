// @flow
import * as React from 'react'
import type {ValidationState} from '../../../../../constants/types/wallets'
import {EnterNamePopup} from '../../../../common'

type Props = {|
  renameAccountError: string,
  error: string,
  name: string,
  nameValidationState: ValidationState,
  onCancel: () => void,
  onCheckName: (name: string) => void,
  onClearErrors: () => void,
  onCreateAccount: () => void,
  onDone: () => void,
  onNameChange: string => void,
  waiting: boolean,
|}

class RenameAccount extends React.Component<Props> {
  render() {
    return (
      <EnterNamePopup
        error={this.props.error || this.props.renameAccountError}
        name={this.props.name}
        onCancel={this.props.onCancel}
        onNameChange={this.props.onNameChange}
        onPrimaryClick={this.props.onDone}
        primaryLabel="Save"
        waiting={this.props.waiting}
      />
    )
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
  componentDidUpdate(prevProps: Props) {
    if (this.props.nameValidationState === 'valid' && prevProps.nameValidationState !== 'valid') {
      this.props.onClearErrors()
      this.props.onCreateAccount()
    }
  }
}

export default RenameAccount
