// @flow
import * as React from 'react'
import Disclaimer from './disclaimer'
import Intro from './intro'

type NextScreen = '' | 'openWallet' | 'linkExisting'

type OnboardingProps = {|
  onAcceptDisclaimer: () => void,
  onClose: () => void,
  setNextScreen: (screen: 'openWallet' | 'linkExisting') => void,
|}

type OnboardingState = {|
  nextScreen: 'openWallet' | 'linkExisting',
|}

class Onboarding extends React.Component<OnboardingProps, OnboardingState> {
  state = {nextScreen: ''}
  _setNextScreen = (nextScreen: NextScreen) => {
    console.warn('in setnextscreen', nextScreen)
    this.setState({nextScreen})
  }
  render() {
    console.warn('in render', this.state.nextScreen)
    if (!this.state.nextScreen) {
      return <Intro onClose={this.props.onClose} setNextScreen={this._setNextScreen} />
    } else {
      console.warn('nextScreen is', this.state.nextScreen)
      return <Disclaimer onAcceptDisclaimer={this.props.onAcceptDisclaimer} onClose={this.props.onClose} />
    }
  }
}

export default Onboarding
