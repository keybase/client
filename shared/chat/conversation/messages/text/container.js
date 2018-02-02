// @flow
import * as Types from '../../../../constants/types/chat2'
import TextMessage from '.'
import {mapProps} from '../../../../util/container'

type Props = {
  isEditing: boolean,
  message: Types.MessageText,
}
export default mapProps((props: Props) => ({
  isEditing: props.isEditing,
  mentionsAt: props.message.mentionsAt,
  mentionsChannel: props.message.mentionsChannel,
  mentionsChannelName: props.message.mentionsChannelName,
  text: props.message.text.stringValue(),
  type: props.message.errorReason ? 'error' : props.message.submitState === null ? 'sent' : 'pending',
}))(TextMessage)
