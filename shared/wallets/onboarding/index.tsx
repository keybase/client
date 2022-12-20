import * as React from 'react'
import type * as Types from '../../constants/types/wallets'
import Disclaimer from './disclaimer'
import Intro from './intro'

type OnboardingProps = {
  acceptDisclaimerError: string
  acceptingDisclaimerDelay: boolean
  nextScreen: Types.NextScreenAfterAcceptance
  onAcceptDisclaimer: () => void
  onCheckDisclaimer: (nextScreen: Types.NextScreenAfterAcceptance) => void
  onClose: () => void
}

type OnboardingState = {
  seenIntro: boolean
}

class Onboarding extends React.Component<OnboardingProps, OnboardingState> {
  state = {seenIntro: false}
  _seenIntro = () => {
    this.setState({seenIntro: true})
  }
  render() {
    if (!this.state.seenIntro) {
      return <Intro onClose={this.props.onClose} onSeenIntro={this._seenIntro} />
    } else {
      return (
        <Disclaimer
          acceptDisclaimerError={this.props.acceptDisclaimerError}
          acceptingDisclaimerDelay={this.props.acceptingDisclaimerDelay}
          onAcceptDisclaimer={this.props.onAcceptDisclaimer}
          onCheckDisclaimer={() => {
            this.props.onCheckDisclaimer(this.props.nextScreen)
          }}
          onNotNow={this.props.onClose}
        />
      )
    }
  }
}

export default Onboarding
