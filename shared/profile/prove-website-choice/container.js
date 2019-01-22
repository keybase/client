// @flow
import * as ProfileGen from '../../actions/profile-gen'
import ProveWebsiteChoice from '.'
import {connect} from '../../util/container'

type OwnProps = {||}

const mapStateToProps = state => ({})

const mapDispatchToProps = dispatch => ({
  onLeftAction: () => dispatch(ProfileGen.createCancelAddProof()),
  onOptionClick: choice => dispatch(ProfileGen.createAddProof({platform: choice === 'file' ? 'web' : 'dns'})),
})

const mergeProps = (stateProps, dispatchProps) => ({
  ...stateProps,
  ...dispatchProps,
  leftAction: 'cancel',
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(ProveWebsiteChoice)
