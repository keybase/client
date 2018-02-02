// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {FileAttachment, ImageAttachment} from '.'
import {connect, type TypedState, type Dispatch} from '../../../../util/container'

type Props = {
  type: Types.AttachmentType,
  message: Types.MessageAttachment,
  onClick: () => void,
}

class Attachment extends React.PureComponent<Props> {
  render() {
    if (this.props.type === 'image') {
      return <ImageAttachment message={this.props.message} onClick={this.props.onClick} />
    }
    return <FileAttachment message={this.props.message} onClick={this.props.onClick} />
  }
}

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onClick: () => {},
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  message: ownProps.message,
  onClick: dispatchProps.onClick,
  type: ownProps.message.attachmentType,
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Attachment)
