// @flow
import * as React from 'react'
import Root from './root'
import {SendBody, RequestBody} from './body/container'
import LinkExisting from '../link-existing/container'
import CreateNewAccount from '../create-account/container'

type FormProps = {|
  onClose: () => void,
|}

type SendFormState = {
  currentScreen: 'root' | 'link-existing' | 'create-new-account',
}

class SendForm extends React.PureComponent<FormProps, SendFormState> {
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
          <Root onClose={this.props.onClose}>
            <SendBody
              isProcessing={undefined /* TODO */}
              onLinkAccount={this.linkExisting}
              onCreateNewAccount={this.createNewAccount}
            />
          </Root>
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

const RequestForm = ({onClose}: FormProps) => (
  <Root onClose={onClose}>
    <RequestBody isProcessing={undefined /* TODO */} />
  </Root>
)

export {SendForm, RequestForm}
