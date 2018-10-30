// @flow
import QRScan from '.'
import {connect} from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'
import * as ConfigGen from '../../actions/config-gen'

const mapStateToProps = () => ({})
const mapDispatchToProps = (dispatch, {navigateUp}) => ({
  onOpenSettings: () => dispatch(ConfigGen.createOpenAppSettings()),
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
