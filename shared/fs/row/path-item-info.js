// @flow
import * as React from 'react'
import {globalStyles, globalColors, isMobile} from '../../styles'
import {Box, Text} from '../../common-adapters'
import moment from 'moment'

type Props = {
  lastModifiedTimestamp: number,
  lastWriter: string,
  wrap?: boolean,
}

const PathItemInfo = ({lastModifiedTimestamp, lastWriter, wrap}: Props) => (
  <Box style={wrap ? timeWriterBoxStyleWithWrap : timeWriterBoxStyle}>
    <Text type="BodySmall" lineClamp={isMobile ? 1 : undefined}>
      {moment(lastModifiedTimestamp).format('MMM D YYYY [at] LT')}
    </Text>
    {lastWriter ? (
      <Text type="BodySmall" style={writerTextStyle} lineClamp={isMobile ? 1 : undefined}>
        &nbsp;by&nbsp;
        {isMobile ? (
          lastWriter
        ) : (
          <Text type="BodySmall" style={writerStyle}>
            {lastWriter}
          </Text>
        )}
      </Text>
    ) : (
      undefined
    )}
  </Box>
)

const writerStyle = {
  color: globalColors.black_60,
}

const timeWriterBoxStyle = {
  ...globalStyles.flexBoxRow,
  width: '100%',
}
const timeWriterBoxStyleWithWrap = {
  ...timeWriterBoxStyle,
  flexWrap: 'wrap',
  justifyContent: 'center',
}

const writerTextStyle = isMobile
  ? {}
  : {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }

export default PathItemInfo
