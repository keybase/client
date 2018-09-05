// @flow
import * as React from 'react'
import type {ValidationState} from '../../constants/types/wallets'
import {EnterNamePopup} from '../common'

type Props = {
  createNewAccountError: string,
  error: string,
  name: string,
  nameValidationState: ValidationState,
  onBack: () => void,
  onCancel: () => void,
  onCheckName: (name: string) => void,
  onClearErrors: () => void,
  onCreateAccount: () => void,
  onDone: () => void,
  onNameChange: string => void,
  waiting: boolean,
}

class CreateAccount extends React.Component<Props> {
  render() {
    return <EnterNamePopup {...this.props} onClose={this.props.onCancel} />
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

export default CreateAccount
