// @flow
import * as React from 'react'
import {isMobile} from '../../styles'
import Root from './root'
import {SendBody, RequestBody} from './body/container'

type FormProps = {|
  onClose: () => void,
|}

type SendFormState = {
  currentScreen: 'root',
}

// On desktop, we switch between views in this container.
// On mobile, we use routing to switch views
class SendForm extends React.PureComponent<FormProps, SendFormState> {
  state = {
    currentScreen: 'root',
  }
  _setCurrentScreen = currentScreen =>
    this.setState(s => (s.currentScreen === currentScreen ? null : {currentScreen}))
  backToRoot = () => this._setCurrentScreen('root')
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
            <SendBody isProcessing={undefined /* TODO */} />
          </Root>
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
