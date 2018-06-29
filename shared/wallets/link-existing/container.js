// @flow
import {connect, type TypedState} from '../../util/container'
import {Wrapper as LinkExisting} from '.'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  onCancel: () => dispatch(navigateUp()),
})

export default connect(mapStateToProps, mapDispatchToProps)(LinkExisting)
