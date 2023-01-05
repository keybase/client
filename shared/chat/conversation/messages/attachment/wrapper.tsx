import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as React from 'react'
import {ConvoIDContext} from '../ids-context'
import {WrapperMessage, useCommon, type Props} from '../wrapper/wrapper'
import type FileAttachmentType from './file/container'
import type ImageAttachmentType from './image/container'
import type AudioAttachmentType from './audio'

const WrapperAttachment = React.memo(function WrapperAttachment(p: Props) {
  const {ordinal} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const common = useCommon(ordinal)
  const {showCenteredHighlight, toggleShowingPopup} = common

  const attachmentType = Container.useSelector(
    state => Constants.getMessage(state, conversationIDKey, ordinal)?.attachmentType
  )

  let child: React.ReactNode = null
  switch (attachmentType) {
    case 'image': {
      const ImageAttachment = require('./image/container').default as typeof ImageAttachmentType
      child = <ImageAttachment toggleMessageMenu={toggleShowingPopup} isHighlighted={showCenteredHighlight} />
      break
    }
    case 'audio': {
      const AudioAttachment = require('./audio').default as typeof AudioAttachmentType
      child = <AudioAttachment />
      break
    }
    default: {
      const FileAttachment = require('./file/container').default as typeof FileAttachmentType
      child = <FileAttachment isHighlighted={showCenteredHighlight} />
    }
  }

  return (
    <WrapperMessage {...p} {...common}>
      {child}
    </WrapperMessage>
  )
})

export default WrapperAttachment
