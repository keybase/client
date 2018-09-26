// @flow
import * as React from 'react'
import type {ValidationState} from '../../../../../constants/types/wallets'
import {EnterNamePopup} from '../../../../common'

type Props = {|
  renameAccountError: string,
  error: string,
  name: string,
  initialName: string,
  nameValidationState: ValidationState,
  onCancel: () => void,
  onCheckName: (name: string) => void,
  onClearErrors: () => void,
  onChangeAccountName: () => void,
  onDone: () => void,
  onNameChange: string => void,
  waiting: boolean,
|}

class RenameAccountPopup extends React.Component<Props> {
  render() {
    return (
      <EnterNamePopup
        error={this.props.error || this.props.renameAccountError}
        name={this.props.name === '__INITIAL_PLACEHOLDER_NAME__' ? this.props.initialName : this.props.name}
        onCancel={this.props.onCancel}
        onNameChange={this.props.onNameChange}
        onPrimaryClick={this.props.onDone}
        primaryLabel="Save"
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
      this.props.onChangeAccountName()
    }
  }
}

export default RenameAccountPopup
