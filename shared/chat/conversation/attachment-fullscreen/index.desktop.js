// @flow
import * as React from 'react'
import {Box, Icon, Text, PopupDialog, ProgressBar} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles, fileUIName, platformStyles} from '../../../styles'

import type {Props} from '.'

const Fullscreen = (props: Props) => {
  return (
    <PopupDialog onClose={props.onClose} fill={true}>
      <Box style={containerStyle}>
        <Box style={headerFooterStyle}>
          <Text type="BodySemibold" style={{color: globalColors.black_75, flex: 1}}>
            {props.title}
          </Text>
          <Icon
            type="iconfont-ellipsis"
            style={{color: globalColors.black_40, cursor: 'pointer', marginLeft: globalMargins.tiny}}
            onClick={event => {
              const node = event.target instanceof window.HTMLElement ? event.target : null
              props.onShowMenu(node ? node.getBoundingClientRect() : null)
            }}
          />
        </Box>
        {props.path && (
          <Box style={props.isZoomed ? styleContentsZoom : styleContentsFit} onClick={props.onToggleZoom}>
            <img src={props.path} style={props.isZoomed ? styleImageZoom : styleImageFit} />
          </Box>
        )}
        <Box style={headerFooterStyle}>
          {!!props.progressLabel && (
            <Text type="BodySmall" style={{color: globalColors.black_60, marginRight: globalMargins.tiny}}>
              {props.progressLabel}
            </Text>
          )}
          {!!props.progressLabel && <ProgressBar ratio={props.progress} />}
          {!props.progressLabel &&
            props.onDownloadAttachment && (
              <Text type="BodySmall" style={linkStyle} onClick={props.onDownloadAttachment}>
                Download
              </Text>
            )}
          {props.onShowInFinder && (
            <Text type="BodySmall" style={linkStyle} onClick={props.onShowInFinder}>
              Show in {fileUIName}
            </Text>
          )}
        </Box>
      </Box>
    </PopupDialog>
  )
}

const linkStyle = platformStyles({
  isElectron: {color: globalColors.black_60, cursor: 'pointer'},
})

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

export default Fullscreen
