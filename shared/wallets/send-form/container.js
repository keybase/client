// @flow
import SendForm from '.'
import {connect, type TypedState, type Dispatch} from '../../util/container'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  onClose: () => dispatch(navigateUp()),
})

export default connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...s, ...d, ...o}))(SendForm)
