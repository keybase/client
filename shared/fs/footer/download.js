// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {globalStyles, globalColors, globalMargins, platformStyles} from '../../styles'
import {Box, ClickableBox, Icon, Text} from '../../common-adapters'
import Progress from '../common/progress'
import {memoize} from 'lodash-es'

export type DownloadProps = {
  error?: Types.FsError,
  filename: string,
  completePortion: number,
  progressText: string,
  isDone: boolean,
  open?: () => void,
  dismiss: () => void,
  cancel: () => void,
}

const Download = (props: DownloadProps) => (
  <Box style={stylesDownload(!!props.error)}>
    <Box style={stylesIconBox}>
      <Icon
        type={props.isDone ? 'iconfont-success' : 'iconfont-download'}
        color={globalColors.black_20}
        fontSize={16}
      />
    </Box>
    <ClickableBox style={stylesNameAndProgressBox} onClick={props.open}>
      <Box style={stylesNameAndProgress}>
        <Text type="BodySmallSemibold" style={stylesText}>
          {props.filename}
        </Text>
        {!props.isDone && (
          <Box style={stylesProgressBox}>
            <Progress completePortion={props.completePortion} text={props.progressText} width={40} />
          </Box>
        )}
      </Box>
    </ClickableBox>
    <ClickableBox style={stylesIconBox} onClick={props.isDone ? props.dismiss : props.cancel}>
      <Icon type="iconfont-remove" color={globalColors.white} fontSize={16} />
    </ClickableBox>
  </Box>
)

const stylesDownload = memoize((errored: boolean) => ({
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  backgroundColor: errored ? globalColors.red : globalColors.green,
  borderRadius: 4,
  height: 32,
  justifyContent: 'flex-start',
  marginLeft: globalMargins.xtiny,
  width: 140,
}))

const stylesIconBox = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'center',
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
  paddingTop: 4,
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

const stylesText = platformStyles({
  common: {
    color: globalColors.white,
  },
  isElectron: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
})

const stylesProgressBox = {
  marginTop: -2,
  marginRight: -globalMargins.tiny,
}

export default Download
