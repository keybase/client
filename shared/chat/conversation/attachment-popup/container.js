// @flow
import RenderAttachmentPopup from './'
import {connect} from 'react-redux'
import {navigateUp} from '../../../actions/route-tree'

import type {TypedState} from '../../../constants/reducer'

export default connect(
  (state: TypedState, {routeProps}) => routeProps,
  (dispatch: Dispatch) => ({
    onClose: () => dispatch(navigateUp()),
  })
)(RenderAttachmentPopup)
