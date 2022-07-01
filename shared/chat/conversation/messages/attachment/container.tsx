import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import FileAttachment from './file/container'
import ImageAttachment from './image/container'
import AudioAttachment from './audio'

type Props = {
  message: Types.MessageAttachment
  toggleMessageMenu: () => void
  isHighlighted?: boolean
}

const Attachment = React.memo((props: Props) => {
  const {isHighlighted, message, toggleMessageMenu} = props
  switch (message.attachmentType) {
    case 'image':
      return (
        <ImageAttachment
          message={message}
          toggleMessageMenu={toggleMessageMenu}
          isHighlighted={isHighlighted}
        />
      )
    case 'audio':
      return <AudioAttachment message={message} />
    default:
      return <FileAttachment message={message} isHighlighted={isHighlighted} />
  }
})

export default Attachment
