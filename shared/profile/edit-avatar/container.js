// @flow
import EditAvatar from '.'
import * as ProfileGen from '../../actions/profile-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
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
  onSave: (filename: string, coordinates?: RPCTypes.ImageCropRect) =>
    dispatch(ProfileGen.createUploadAvatar({coordinates, filename})),
})

export default connect(mapStateToProps, mapDispatchToProps)(EditAvatar)
