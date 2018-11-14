// @flow
import QRScan from '.'
import {connect} from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'

const mapStateToProps = () => ({})
const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onSubmitCode: (to: ?string) => {
    if (to) {
      dispatch(WalletsGen.createSetBuildingRecipientType({recipientType: 'stellarPublicKey'}))
      dispatch(WalletsGen.createSetBuildingTo({to}))
    }
    dispatch(navigateUp())
  },
})
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...dispatchProps,
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(QRScan)
