import * as ProfileGen from '../../actions/profile-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import ProveWebsiteChoice from '.'
import {connect} from '../../util/container'

type OwnProps = {}

const mapStateToProps = state => ({})

const mapDispatchToProps = dispatch => ({
  onCancel: () => {
    dispatch(ProfileGen.createCancelAddProof())
    dispatch(RouteTreeGen.createClearModals())
  },
  onDNS: () => dispatch(ProfileGen.createAddProof({platform: 'dns'})),
  onFile: () => dispatch(ProfileGen.createAddProof({platform: 'web'})),
})

// @ts-ignore codemode issue
export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(ProveWebsiteChoice)
