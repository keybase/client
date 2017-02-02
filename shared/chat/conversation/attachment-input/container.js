// @flow
import RenderAttachmentInput from './'
import {connect} from 'react-redux'
import {navigateUp} from '../../../actions/route-tree'

import type {RouteProps} from '../../../route-tree/render-route'
import type {TypedState} from '../../../constants/reducer'
import type {AttachmentInput, SelectAttachment} from '../../../constants/chat'

type AttachmentInputRouteProps = RouteProps<{
  input: AttachmentInput,
}, {}>
type OwnProps = AttachmentInputRouteProps & {
  title: string,
}

export default connect(
  (state: TypedState, {routeProps}: OwnProps) => {
    const {input} = routeProps
    return {
      input,
      title: input.title,
    }
  },
  (dispatch: Dispatch) => ({
    onClose: () => dispatch(navigateUp()),
    onSelect: (input: AttachmentInput) => {
      dispatch(navigateUp())
      dispatch(({payload: {input}, type: 'chat:selectAttachment'}: SelectAttachment))
    },
  }),
  (stateProps, dispatchProps) => {
    const {input} = stateProps
    return {
      ...stateProps,
      ...dispatchProps,
      onSelect: (title: string) => {
        dispatchProps.onSelect({
          conversationIDKey: input.conversationIDKey,
          filename: input.filename,
          title,
          type: input.type,
        })
      },
    }
  },
)(RenderAttachmentInput)
