// @flow
import RenderAttachmentInput from './'
import {connect} from 'react-redux'
import {navigateUp} from '../../../actions/route-tree'

import type {RouteProps} from '../../../route-tree/render-route'
import type {TypedState} from '../../../constants/reducer'
import type {AttachmentInput, SelectAttachment} from '../../../constants/chat'

type AttachmentInputRouteProps = RouteProps<{
  inputs: Array<AttachmentInput>,
}, {}>
type OwnProps = AttachmentInputRouteProps & {}

export default connect(
  (state: TypedState, {routeProps}: OwnProps) => {
    const {inputs} = routeProps
    return {
      inputs,
    }
  },
  (dispatch: Dispatch) => ({
    onClose: () => dispatch(navigateUp()),
    onSelect: (input: AttachmentInput, title: string, close: boolean) => {
      if (close) {
        dispatch(navigateUp())
      }
      const newInput = {
        conversationIDKey: input.conversationIDKey,
        filename: input.filename,
        title,
        type: input.type,
      }
      dispatch(({payload: {input: newInput}, type: 'chat:selectAttachment'}: SelectAttachment))
    },
  })
)(RenderAttachmentInput)
