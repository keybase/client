// @flow
import * as React from 'react'
import type {ValidationState} from '../../../../../constants/types/wallets'
import {EnterNamePopup} from '../../../../common'

type Props = {|
  renameAccountError: string,
  error: string,
  initialName: string,
  nameValidationState: ValidationState,
  onCancel: () => void,
  onClearErrors: () => void,
  onChangeAccountName: (name: string) => void,
  onDone: (name: string) => void,
  waiting: boolean,
|}

type State = {|
  name: string,
|}

class RenameAccountPopup extends React.Component<Props, State> {
  state = {name: this.props.initialName}

  _onNameChange = name => this.setState({name})

  componentDidMount() {
    this.props.onClearErrors()
  }

  componentWillUnmount() {
    this.props.onClearErrors()
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.nameValidationState === 'valid' && prevProps.nameValidationState !== 'valid') {
      this.props.onClearErrors()
      this.props.onChangeAccountName(this.state.name)
    }
  }

  render() {
    return (
      <EnterNamePopup
        error={this.props.error || this.props.renameAccountError}
        name={this.state.name}
        onCancel={this.props.onCancel}
        onNameChange={this._onNameChange}
        onPrimaryClick={() => this.props.onDone(this.state.name)}
        primaryLabel="Save"
        primaryDisabled={this.state.name === this.props.initialName}
        waiting={this.props.waiting}
      />
    )
  }
}

export default RenameAccountPopup
