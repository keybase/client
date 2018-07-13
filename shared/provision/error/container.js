// @flow
import RenderError from '.'
import {connect, type Dispatch, type TypedState} from '../../util/container'
import {type RouteProps} from '../../route-tree/render-route'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = (state: TypedState) => ({
  error: state.login.error.stringValue(),
})

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  onBack: () => dispatch(ownProps.navigateUp()),
})

export default connect(mapStateToProps, mapDispatchToProps)(RenderError)
