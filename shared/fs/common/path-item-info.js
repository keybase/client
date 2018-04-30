// @flow
import * as React from 'react'
import {globalStyles, globalColors, isMobile, platformStyles} from '../../styles'
import {Box, Text} from '../../common-adapters'
import {formatTimeForFS} from '../../util/timestamp'

type Props = {
  lastModifiedTimestamp: number,
  lastWriter: string,
  wrap?: boolean,
  startWithLastModified?: boolean,
}

const PathItemInfo = (props: Props) => (
  <Box style={props.wrap ? timeWriterBoxStyleWithWrap : timeWriterBoxStyle}>
    <Text type="BodySmall" lineClamp={isMobile ? 1 : undefined}>
      {(props.startWithLastModified ? 'Last modified ' : '') + formatTimeForFS(props.lastModifiedTimestamp)}
    </Text>
    {props.lastWriter ? (
      <Text type="BodySmall" style={writerTextStyle} lineClamp={isMobile ? 1 : undefined}>
        &nbsp;by&nbsp;
        <Text type="BodySmall" style={writerStyle}>
          {props.lastWriter}
        </Text>
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
}

const timeWriterBoxStyleWithWrap = {
  ...timeWriterBoxStyle,
  flexWrap: 'wrap',
  justifyContent: 'center',
}

const writerTextStyle = platformStyles({
  isElectron: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
})

export default PathItemInfo
