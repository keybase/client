import * as ProfileGen from '../../actions/profile-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import ProveWebsiteChoice from '.'
import {connect} from '../../util/container'

type OwnProps = {}

export default connect(
  () => ({}),
  dispatch => ({
    onCancel: () => {
      dispatch(ProfileGen.createCancelAddProof())
      dispatch(RouteTreeGen.createClearModals())
    },
    onDNS: () => dispatch(ProfileGen.createAddProof({platform: 'dns', reason: 'profile'})),
    onFile: () => dispatch(ProfileGen.createAddProof({platform: 'web', reason: 'profile'})),
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(ProveWebsiteChoice)
