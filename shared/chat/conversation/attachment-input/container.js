// @flow
import RenderAttachmentInput from './'
import {connect, type TypedState} from '../../../util/container'
import {navigateUp} from '../../../actions/route-tree'
import {type RouteProps} from '../../../route-tree/render-route'
import {type AttachmentInput, type SelectAttachment} from '../../../constants/chat'

type OwnProps = RouteProps<
  {
    inputs: Array<AttachmentInput>,
  },
  {}
>

export default connect(
  (state: TypedState, {routeProps}: OwnProps) => {
    const inputs = routeProps.get('inputs')
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
