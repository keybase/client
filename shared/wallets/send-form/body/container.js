// @flow
import Body from '.'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../../util/container'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch) => ({})

const mergeProps = (stateProps, dispatchProps) => ({})

// $FlowIssue TODO
export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('Body'))(Body)
