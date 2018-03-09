// @flow
import Files from './index'
import {connect, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState) => ({
  kbfsEnabled: false,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({})

const mergeProps = ({kbfsEnabled}) => ({
  kbfsEnabled,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Files)
