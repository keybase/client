import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import {ValidationState} from '../../../../../constants/types/wallets'
import {EnterName, WalletPopup} from '../../../../common'
import * as Styles from '../../../../../styles'

type Props = {
  initialName: string
  onCancel: () => void
  onClearErrors: () => void
  onChangeAccountName: (name: string) => Promise<void>
  onValidate: (name: string) => Promise<void>
  waiting: boolean
}

type State = {
  error: string
  name: string
}

class RenameAccountPopup extends React.Component<Props, State> {
  state = {error: '', name: this.props.initialName}

  _disabled = () => !this.state.name || this.state.name === this.props.initialName
  _onNameChange = name => this.setState({name})

  _onDone = () => {
    if (this._disabled() || this.props.waiting) return
    this.props
      .onValidate(this.state.name)
      .then(() => {
        this.props
          .onChangeAccountName(this.state.name)
          .then(this.props.onCancel)
          .catch(error => {
            this.setState({
              error: 'There was a problem renaming your account, please try again. ' + error.message,
            })
          })
      })
      .catch(error => this.setState({error: `Invalid account name: ${error.message}`}))
  }

  _getBottomButtons = () => [
    ...(Styles.isMobile
      ? []
      : [
          <Kb.Button
            key={0}
            type="Dim"
            onClick={this.props.onCancel}
            label="Cancel"
            disabled={this.props.waiting}
          />,
        ]),
    <Kb.Button
      key={1}
      type="Wallet"
      onClick={this._onDone}
      label="Save"
      disabled={this._disabled()}
      fullWidth={Styles.isMobile}
      waiting={this.props.waiting}
    />,
  ]

  componentWillUnmount() {
    this.props.onClearErrors()
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
          error={this.state.error}
          name={this.state.name}
          onEnterKeyDown={this._onDone}
          onNameChange={this._onNameChange}
        />
      </WalletPopup>
    )
  }
}

export default RenameAccountPopup
