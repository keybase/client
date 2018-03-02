// @flow
import * as React from 'react'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {Box, ClickableBox, Icon, Text} from '../../common-adapters'
import Progress from './progress'

const stylesDownload = {
  width: 144,
  height: 32,
  borderRadius: 4,
  backgroundColor: globalColors.green,
  marginLeft: globalMargins.xtiny,
  ...globalStyles.flexBoxRow,
  justifyContent: 'flex-start',
  alignItems: 'center',
}

const stylesIconBox = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'center',
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
  paddingTop: 4,
}

const stylesIcon = {
  fontSize: 16,
  color: globalColors.black_20,
}

const stylesNameAndProgressBox = {
  ...globalStyles.flexGrow,
  minWidth: 0,
}

const stylesNameAndProgress = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  justifyContent: 'space-between',
}

const stylesText = {
  color: globalColors.white,
  lineHeight: 1.2,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

export type DownloadProps = {
  filename: string,
  completePortion: number,
  progressText: string,
  open: () => void,
  dismiss: () => void,
}

const Download = (props: DownloadProps) => (
  <Box style={stylesDownload}>
    <Box style={stylesIconBox}>
      <Icon type="iconfont-folder-downloads" style={stylesIcon} />
    </Box>
    <ClickableBox style={stylesNameAndProgressBox} onClick={props.open}>
      <Box style={stylesNameAndProgress}>
        <Text type="BodySmallSemibold" style={stylesText}>
          {props.filename}
        </Text>
        {props.completePortion !== 1 && (
          <Progress completePortion={props.completePortion} text={props.progressText} />
        )}
      </Box>
    </ClickableBox>
    <ClickableBox style={stylesIconBox} onClick={props.dismiss}>
      <Icon type="iconfont-remove" style={stylesIcon} />
    </ClickableBox>
  </Box>
)

export default Download
