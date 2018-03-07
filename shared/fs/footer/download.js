// @flow
import * as React from 'react'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {Box, ClickableBox, Icon, Text} from '../../common-adapters'
import Progress from './progress'

export type DownloadProps = {
  filename: string,
  completePortion: number,
  progressText: string,
  isDone: boolean,
  open: () => void,
  dismiss: () => void,
}

const Download = (props: DownloadProps) => (
  <Box style={stylesDownload}>
    <Box style={stylesIconBox}>
      <Icon type={props.isDone ? 'iconfont-success' : 'iconfont-download'} style={stylesIconLeft} />
    </Box>
    <ClickableBox style={stylesNameAndProgressBox} onClick={props.open}>
      <Box style={stylesNameAndProgress}>
        <Text type="BodySmallSemibold" style={stylesText}>
          {props.filename}
        </Text>
        {!props.isDone && (
          <Box style={stylesProgressBox}>
            <Progress completePortion={props.completePortion} text={props.progressText} />
          </Box>
        )}
      </Box>
    </ClickableBox>
    <ClickableBox style={stylesIconBox} onClick={props.dismiss}>
      <Icon type="iconfont-remove" style={stylesIconRight} />
    </ClickableBox>
  </Box>
)

const stylesDownload = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  backgroundColor: globalColors.green,
  borderRadius: 4,
  height: 32,
  justifyContent: 'flex-start',
  marginLeft: globalMargins.xtiny,
  width: 140,
}

const stylesIconBox = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'center',
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
  paddingTop: 4,
}

const stylesIconLeft = {
  color: globalColors.black_20,
  fontSize: 16,
}

const stylesIconRight = {
  color: globalColors.white,
  fontSize: 16,
}

const stylesNameAndProgressBox = {
  ...globalStyles.flexGrow,
  marginTop: -1,
  minWidth: 0,
}

const stylesNameAndProgress = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  justifyContent: 'center',
}

const stylesText = {
  color: globalColors.white,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const stylesProgressBox = {
  marginTop: -2,
}

export default Download
