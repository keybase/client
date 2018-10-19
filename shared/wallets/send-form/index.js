// @flow
import * as React from 'react'
import {isMobile} from '../../styles'
import Root from './root'
import {SendBody, RequestBody} from './body/container'
import LinkExisting from '../link-existing/container'
import CreateNewAccount from '../create-account/container'
import ChooseAsset from './choose-asset/container'
import Confirm from '../confirm-form/container'

type FormProps = {|
  onClose: () => void,
|}

type SendFormState = {
  currentScreen: 'root' | 'link-existing' | 'create-new-account' | 'choose-asset' | 'confirm',
}

// On desktop, we switch between views in this container.
// On mobile, we use routing to switch views
class SendForm extends React.PureComponent<FormProps, SendFormState> {
  state = {
    currentScreen: 'root',
  }
  _setCurrentScreen = currentScreen =>
    this.setState(s => (s.currentScreen === currentScreen ? null : {currentScreen}))
  linkExisting = () => this._setCurrentScreen('link-existing')
  createNewAccount = () => this._setCurrentScreen('create-new-account')
  backToRoot = () => this._setCurrentScreen('root')
  chooseAsset = () => this._setCurrentScreen('choose-asset')
  confirm = () => this._setCurrentScreen('confirm')
  render() {
    if (isMobile) {
      return (
        <Root onClose={this.props.onClose}>
          <SendBody isProcessing={undefined /* TODO */} />
        </Root>
      )
    }
    switch (this.state.currentScreen) {
      case 'root':
        return (
          <Root onClose={this.props.onClose}>
            <SendBody
              isProcessing={undefined /* TODO */}
              onLinkAccount={this.linkExisting}
              onChooseAsset={this.chooseAsset}
              onCreateNewAccount={this.createNewAccount}
              onConfirm={this.confirm}
            />
          </Root>
        )
      case 'link-existing':
        return (
          <LinkExisting
            onCancel={this.backToRoot}
            onBack={this.backToRoot}
            fromSendForm={true}
            navigateUp={null}
            routeProps={null}
          />
        )
      case 'create-new-account':
        return (
          <CreateNewAccount
            onCancel={this.backToRoot}
            onBack={this.backToRoot}
            fromSendForm={true}
            navigateUp={null}
            routeProps={null}
          />
        )
      case 'choose-asset':
        return <ChooseAsset onBack={this.backToRoot} />
      case 'confirm':
        return <Confirm onBack={this.backToRoot} />
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
