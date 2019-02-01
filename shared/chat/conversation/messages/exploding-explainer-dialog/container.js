// @flow
import ExplodingExplainer from '.'
import {type RouteProps} from '../../../../route-tree/render-route'
import {compose, connect} from '../../../../util/container'
import {isMobile} from '../../../../constants/platform'

type OwnProps = RouteProps<{}, {}>

const mapStateToProps = (state, ownProps: OwnProps) => ({})

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onBack: isMobile ? undefined : () => dispatch(ownProps.navigateUp()),
  onCancel: () => dispatch(ownProps.navigateUp()),
})

const mergeProps = (stateProps, dispatchProps) => ({
  onBack: dispatchProps.onBack,
  onCancel: dispatchProps.onCancel,
})

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  )
)(ExplodingExplainer)
