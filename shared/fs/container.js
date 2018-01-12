// @flow
import {connect, type TypedState, type Dispatch} from '../util/container'
import * as FSGen from '../actions/fs-gen'
import Fs from '.'

const mapStateToProps = (state: TypedState) => ({
  counter: state.fs.counter,
  you: state.config.username,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  increase: () => dispatch(FSGen.createIncreaseCount({amount: 1})),
  increase10: () => dispatch(FSGen.createIncreaseCount({amount: 10})),
})

export default connect(mapStateToProps, mapDispatchToProps)(Fs)
