// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as FsTypes from '../../../../constants/types/fs'
import {Markdown} from '../../../../common-adapters'
import OpenInFilesTabHoc from '../../../../fs/common/open-in-files-tab-hoc'
import {globalColors, globalMargins, platformStyles, styleSheetCreate, isMobile} from '../../../../styles'

export type Props = {
  text: string,
  type: 'error' | 'pending' | 'sent',
  isEditing: boolean,
  mentionsAt: Types.MentionsAt,
  mentionsChannel: Types.MentionsChannel,
  mentionsChannelName: Types.MentionsChannelName,
  onOpenInFilesTab: FsTypes.Path => void,
}

const MessageText = ({
  text,
  type,
  isEditing,
  mentionsAt,
  mentionsChannel,
  mentionsChannelName,
  onOpenInFilesTab,
}: Props) => (
  <Markdown
    style={getStyle(type, isEditing)}
    meta={{mentionsAt, mentionsChannel, mentionsChannelName, onOpenInFilesTab}}
    styleOverride={isMobile ? {paragraph: getStyle(type, isEditing)} : undefined}
    allowFontScaling={true}
  >
    {text}
  </Markdown>
)

// Encoding all 4 states as static objects so we don't re-render
const getStyle = (type, isEditing) => {
  if (type === 'sent') {
    return isEditing ? styles.sentEditing : styles.sent
  } else {
    return isEditing ? styles.pendingFailEditing : styles.pendingFail
  }
}

const editing = {
  backgroundColor: globalColors.yellow3,
  borderRadius: 2,
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
}
const sent = platformStyles({
  isElectron: {
    // Make text selectable. On mobile we implement that differently.
    cursor: 'text',
    userSelect: 'text',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    width: '100%',
  },
})
const sentEditing = {
  ...sent,
  ...editing,
}
const pendingFail = {
  ...sent,
}
const pendingFailEditing = {
  ...pendingFail,
  ...editing,
}
const styles = styleSheetCreate({
  editing,
  pendingFail,
  pendingFailEditing,
  sent,
  sentEditing,
})

export default OpenInFilesTabHoc(MessageText)
