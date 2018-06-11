// @flow
import EditAvatar from '.'
import {connect, type TypedState} from '../../util/container'
import {navigateUp} from '../../actions/route-tree'

const mapStateToProps = (state: TypedState) => {
  const username = state.config.username
  if (!username) {
    throw new Error('Not logged in')
  }

  return {
    keybaseUsername: username,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onClose: () => dispatch(navigateUp()),
  onSave: () => {},
})

export default connect(mapStateToProps, mapDispatchToProps)(EditAvatar)
