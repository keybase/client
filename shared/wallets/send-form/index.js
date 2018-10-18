// @flow
import * as React from 'react'
import Root from './root'
import {SendBody, RequestBody} from './body/container'
import LinkExisting from '../link-existing/container'
import CreateNewAccount from '../create-account/container'

type FormProps = {|
  isRequest: boolean,
  onClose: () => void,
|}

type SendRequestFormState = {
  currentScreen: 'root' | 'link-existing' | 'create-new-account',
}

// Controls switching between 'root' (send or request form) and auxiliary screens.
class SendRequestForm extends React.PureComponent<FormProps, SendRequestFormState> {
  state = {
    currentScreen: 'root',
  }
  _setScreen = currentScreen =>
    this.setState(s => (s.currentScreen === currentScreen ? null : {currentScreen}))
  linkExisting = () => this._setScreen('link-existing')
  createNewAccount = () => this._setScreen('create-new-account')
  backToRoot = () => this._setScreen('root')

  render() {
    switch (this.state.currentScreen) {
      case 'root':
        return (
          <Root onClose={this.props.onClose}>
            {this.props.isRequest ? (
              <RequestBody isProcessing={undefined} />
            ) : (
              <SendBody
                isProcessing={undefined /* TODO */}
                onLinkAccount={this.linkExisting}
                onCreateNewAccount={this.createNewAccount}
              />
            )}
          </Root>
        )
      case 'link-existing':
        return (
          <LinkExisting
            onCancel={this.props.onClose}
            onBack={this.backToRoot}
            fromSendRequestForm={true}
            navigateUp={null}
            routeProps={null}
          />
        )
      case 'create-new-account':
        return (
          <CreateNewAccount
            onCancel={this.props.onClose}
            onBack={this.backToRoot}
            fromSendRequestForm={true}
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

export default SendRequestForm
