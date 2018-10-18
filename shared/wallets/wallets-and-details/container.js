// @flow
import WalletsAndDetails from '.'
import Onboarding from '../onboarding/container'
import * as WalletsGen from '../../actions/wallets-gen'
import {connect} from '../../util/container'

type Props = {
  acceptedDisclaimer: boolean,
}

const mapStateToProps = state => ({
  acceptedDisclaimer: state.wallets.acceptedDisclaimer,
})

const mapDispatchToProps = dispatch => ({})

const mergeProps = (stateProps, dispatchProps, ownProps): Props => ({
  acceptedDisclaimer: stateProps.acceptedDisclaimer,
})

const WalletOrOnboarding = (props: Props) => props.acceptedDisclaimer ? WalletList : Onboarding

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(WalletOrOnboarding)
