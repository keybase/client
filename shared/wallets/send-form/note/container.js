// @flow
import Note from '.'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../../util/container'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch) => ({})

const mergeProps = (stateProps, dispatchProps) => ({})

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('Note'))(Note)
