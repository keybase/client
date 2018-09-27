// @flow
import Banner from '.'
import {compose, connect, setDisplayName, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch) => ({})

const mergeProps = (stateProps, dispatchProps) => ({})

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  // $FlowIssue TODO
  setDisplayName('Banner')
)(Banner)
