// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import type {ValidationState} from '../../constants/types/wallets'
import {EnterName} from '../link-existing/index'

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
    return (
      <Kb.MaybePopup onClose={this.props.onCancel}>
        <EnterName {...this.props} />
      </Kb.MaybePopup>
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

export default CreateAccount
