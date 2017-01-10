// @flow
import {compose, withState, withProps} from 'recompose'
import RenderAttachmentPopup from './'
import {connect} from 'react-redux'
import {navigateUp} from '../../../actions/route-tree'

import type {TypedState} from '../../../constants/reducer'

export default compose(
  withState('isZoomed', 'setZoomed', false),
  withState('detailsPopupShowing', 'setDetailsPopupShowing', false),
  withProps(({setZoomed, setDetailsPopupShowing}) => ({
    onToggleZoom: () => setZoomed(zoomed => !zoomed),
    onOpenDetailsPopup: () => setDetailsPopupShowing(true),
    onCloseDetailsPopup: () => setDetailsPopupShowing(false),
  })),
  connect(
    (state: TypedState, {routeProps}) => routeProps,
    (dispatch: Dispatch) => ({
      onClose: () => dispatch(navigateUp()),
    })
  ),
)(RenderAttachmentPopup)
