// @flow
import * as ProvisionGen from '../../actions/provision-gen'
import {connect} from '../../util/container'
import {type RouteProps} from '../../route-tree/render-route'
import GPGSign from '.'

type OwnProps = RouteProps<{}, {}>

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onBack: () => dispatch(ownProps.navigateUp()),
  onSubmit: exportKey => dispatch(ProvisionGen.createSubmitGPGMethod({exportKey})),
})

export default connect(() => ({}), mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d}))(GPGSign)
