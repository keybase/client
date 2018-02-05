// @flow
import * as React from 'react'
import {Box, Icon, Text, PopupDialog, ProgressIndicator} from '../../../common-adapters/index'
// import {AttachmentPopupMenu} from '../messages/popup.desktop'
// import {ProgressBar as AttachmentProgressBar, ImageIcon as AttachmentStatusIcon} from '../messages/attachment'
import {globalColors, globalMargins, globalStyles} from '../../../styles'
// import {fileUIName} from '../../../constants/platform'

import type {Props} from '.'
// import type {LocalMessageState} from '../../../constants/types/chat'
//

const AttachmentPopup = (props: Props) => {
  return (
    <PopupDialog onClose={props.onClose} fill={true}>
      <Box style={containerStyle}>
        <Box style={headerFooterStyle}>
          <Text type="BodySemibold" style={{color: globalColors.black_75, flex: 1}}>
            {props.title}
          </Text>
          {!props.deviceFilePath && <ProgressIndicator style={{width: 24}} />}
          <Icon
            type="iconfont-ellipsis"
            style={{color: globalColors.black_40, cursor: 'pointer', marginLeft: globalMargins.tiny}}
            onClick={event => {
              const node = event.target instanceof window.HTMLElement ? event.target : null
              props.onShowMenu(node ? node.getBoundingClientRect() : null)
            }}
          />
        </Box>
        {props.deviceFilePath ||
          (props.devicePreviewPath && (
            <Box style={props.isZoomed ? styleContentsZoom : styleContentsFit} onClick={props.onToggleZoom}>
              <img
                src={props.deviceFilePath || props.devicePreviewPath}
                style={props.isZoomed ? styleImageZoom : styleImageFit}
              />
            </Box>
          ))}
        <Box style={headerFooterStyle}>
          {props.onDownloadAttachment && (
            <Text
              type="BodySmall"
              style={{color: globalColors.black_60, cursor: 'pointer'}}
              onClick={props.onDownloadAttachment}
            >
              Download
            </Text>
          )}
        </Box>
      </Box>
    </PopupDialog>
  )
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  height: '100%',
  width: '100%',
}

const headerFooterStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: 32,
  paddingLeft: globalMargins.tiny,
  paddingRight: globalMargins.tiny,
  width: '100%',
}

const styleContentsFit = {
  ...globalStyles.flexBoxRow,
  flex: 1,
}

const progressContainerStyle = {
  ...styleContentsFit,
  alignItems: 'center',
  justifyContent: 'center',
}

const styleContentsZoom = {
  display: 'block',
  flex: 1,
  overflow: 'auto',
}

const styleImageFit = {
  cursor: 'zoom-in',
  display: 'block',
  objectFit: 'scale-down',
  width: '100%',
}

const styleImageZoom = {
  cursor: 'zoom-out',
  display: 'block',
  minHeight: '100%',
  minWidth: '100%',
}

export default AttachmentPopup
