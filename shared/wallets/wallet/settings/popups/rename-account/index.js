// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import type {ValidationState} from '../../../../../constants/types/wallets'
import {EnterName, WalletPopup} from '../../../../common'
import * as Styles from '../../../../../styles'

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
      onClick={() => this.props.onDone(this.state.name)}
      label="Save"
      disabled={!this.state.name || this.state.name === this.props.initialName}
      fullWidth={Styles.isMobile}
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
      this.props.onChangeAccountName(this.state.name)
    }
  }

  render() {
    return (
      <WalletPopup
        accountName={this.props.initialName}
        bottomButtons={this._getBottomButtons()}
        backButtonType="cancel"
        onExit={this.props.onCancel}
        headerTitle="Rename account"
      >
        <EnterName
          error={this.props.error || this.props.renameAccountError}
          name={this.state.name}
          onNameChange={this._onNameChange}
        />
      </WalletPopup>
    )
  }
}

export default RenameAccountPopup
