// @flow
import * as ProvisionGen from '../../../actions/provision-gen'
import {connect, type Dispatch} from '../../../util/container'
import {type RouteProps} from '../../../route-tree/render-route'
import GPGSign from '.'

type OwnProps = RouteProps<{}, {}>

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  onBack: () => dispatch(ownProps.navigateUp()),
  onSubmit: exportKey => dispatch(ProvisionGen.createSubmitProvisionGPGMethod({exportKey})),
})

export default connect(undefined, mapDispatchToProps)(GPGSign)
