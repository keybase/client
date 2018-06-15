// @flow
import EditAvatar from '.'
import * as ProfileGen from '../../actions/profile-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import {connect, type TypedState} from '../../util/container'
import {navigateUp} from '../../actions/route-tree'
import type {RouteProps} from '../../route-tree/render-route'

const mapStateToProps = (state: TypedState, {routeProps}: RouteProps<{image: ?Object}, {}>) => ({
  image: routeProps.get('image'),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onClose: () => dispatch(navigateUp()),
  onSave: (filename: string, crop?: RPCTypes.ImageCropRect) =>
    dispatch(ProfileGen.createUploadAvatar({crop, filename})),
})

export default connect(mapStateToProps, mapDispatchToProps)(EditAvatar)
