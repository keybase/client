// @flow
import * as React from 'react'
import SendFormRoot from './root-container'
import LinkExisting from '../link-existing/container'
import CreateNewAccount from '../create-account/container'

type Props = {|
  isRequest: boolean,
  onClose: () => void,
|}

type State = {
  currentScreen: 'root' | 'link-existing' | 'create-new-account',
}

class SendForm extends React.PureComponent<Props, State> {
  state = {
    currentScreen: 'root',
  }
  linkExisting = () => {
    this.setState(() => ({
      currentScreen: 'link-existing',
    }))
  }
  createNewAccount = () => {
    this.setState(() => ({
      currentScreen: 'create-new-account',
    }))
  }
  backToRoot = () => {
    this.setState(() => ({
      currentScreen: 'root',
    }))
  }
  render() {
    switch (this.state.currentScreen) {
      case 'root':
        return (
          <SendFormRoot
            isRequest={this.props.isRequest}
            onClose={this.props.onClose}
            onLinkAccount={this.linkExisting}
            onCreateNewAccount={this.createNewAccount}
          />
        )
      case 'link-existing':
        return (
          <LinkExisting
            onCancel={this.props.onClose}
            onBack={this.backToRoot}
            fromSendForm={true}
            navigateUp={null}
            routeProps={null}
          />
        )
      case 'create-new-account':
        return (
          <CreateNewAccount
            onCancel={this.props.onClose}
            onBack={this.backToRoot}
            fromSendForm={true}
            navigateUp={null}
            routeProps={null}
          />
        )
      default:
        /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (currentScreen: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(this.state.currentScreen);
      */
        return null
    }
  }
}

export default SendForm
