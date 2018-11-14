// @flow
import * as React from 'react'
import * as Types from '../../constants/types/wallets'
import Disclaimer from './disclaimer'
import Intro from './intro'

type OnboardingProps = {|
  onAcceptDisclaimer: (nextScreen: Types.NextScreenAfterAcceptance) => void,
  onClose: () => void,
|}

type OnboardingState = {|
  nextScreen: '' | 'openWallet' | 'linkExisting',
|}

class Onboarding extends React.Component<OnboardingProps, OnboardingState> {
  state = {nextScreen: ''}
  _setNextScreen = (nextScreen: Types.NextScreenAfterAcceptance) => {
    this.setState({nextScreen})
  }
  render() {
    if (!this.state.nextScreen) {
      return <Intro onClose={this.props.onClose} setNextScreen={this._setNextScreen} />
    } else {
      return (
        <Disclaimer
          onAcceptDisclaimer={() => {
            if (this.state.nextScreen) {
              this.props.onAcceptDisclaimer(this.state.nextScreen)
            }
          }}
          onNotNow={this.props.onClose}
        />
      )
    }
  }
}

export default Onboarding
