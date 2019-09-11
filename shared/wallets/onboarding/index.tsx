import * as React from 'react'
import * as Types from '../../constants/types/wallets'
import Disclaimer from './disclaimer'
import Intro from './intro'

type OnboardingProps = {
  acceptDisclaimerError: string
  acceptingDisclaimerDelay: boolean
  headerBody: string
  headerTitle: string
  nextScreen: Types.NextScreenAfterAcceptance
  onAcceptDisclaimer: () => void
  onCheckDisclaimer: (nextScreen: Types.NextScreenAfterAcceptance) => void
  onLoadDetails: () => void
  onClose: () => void
  sections: Types.StellarDetailsSections
}

type OnboardingState = {
  seenIntro: boolean
}

class Onboarding extends React.Component<OnboardingProps, OnboardingState> {
  state = {seenIntro: false}
  _seenIntro = () => {
    this.setState({seenIntro: true})
  }
  componentDidMount() {
    this.props.onLoadDetails()
  }
  render() {
    if (!this.state.seenIntro) {
      return (
        <Intro
          headerBody={this.props.headerBody}
          headerTitle={this.props.headerTitle}
          onClose={this.props.onClose}
          onSeenIntro={this._seenIntro}
        />
      )
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
          sections={this.props.sections}
        />
      )
    }
  }
}

export default Onboarding
