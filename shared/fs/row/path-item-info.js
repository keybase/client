// @flow
import * as React from 'react'
import {globalStyles, globalColors} from '../../styles'
import {Box, Text} from '../../common-adapters'
import moment from 'moment'

type Props = {
  lastModifiedTimestamp: number,
  lastWriter: string,
}

const PathItemInfo = ({lastModifiedTimestamp, lastWriter}: Props) => (
  <Box style={timeWriterBoxStyle}>
    <Text type="BodySmall">{moment(lastModifiedTimestamp).format('MMM D YYYY [at] LT')}</Text>
    {lastWriter && (
      <Text type="BodySmall">
        &nbsp;by&nbsp;
        <span style={writerStyle}>{lastWriter}</span>
      </Text>
    )}
  </Box>
)

const writerStyle = {
  color: globalColors.black_60,
}

const timeWriterBoxStyle = {
  ...globalStyles.flexBoxRow,
}

export default PathItemInfo
