// @flow
import QRScan from '.'
import {connect, type RouteProps} from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'

type OwnProps = RouteProps<{}, {}>

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
const mergeProps = (stateProps, dispatchProps) => ({
  ...dispatchProps,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(QRScan)
