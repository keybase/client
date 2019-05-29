import * as ProvisionGen from '../../actions/provision-gen'
import PaperKey from '.'
import {connect} from '../../util/container'
import HiddenString from '../../util/hidden-string'
import {RouteProps} from '../../route-tree/render-route'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  error: state.provision.error.stringValue(),
  hint: `${state.provision.codePageOtherDeviceName || ''}...`,
})

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  // TODO remove
  onBack: () => {},
  onSubmit: (paperKey: string) =>
    dispatch(ProvisionGen.createSubmitPaperkey({paperkey: new HiddenString(paperKey)})),
})

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(PaperKey)
