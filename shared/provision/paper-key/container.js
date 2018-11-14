// @flow
import * as ProvisionGen from '../../actions/provision-gen'
import PaperKey from '.'
import {connect} from '../../util/container'
import HiddenString from '../../util/hidden-string'
import {type RouteProps} from '../../route-tree/render-route'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = state => ({
  error: state.provision.error.stringValue(),
  hint: `${state.provision.codePageOtherDeviceName || ''}...`,
})

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onBack: () => dispatch(ownProps.navigateUp()),
  onSubmit: (paperKey: string) =>
    dispatch(ProvisionGen.createSubmitPaperkey({paperkey: new HiddenString(paperKey)})),
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(PaperKey)
