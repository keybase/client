// @flow
import * as React from 'react'
import {globalStyles, globalColors, isMobile, platformStyles} from '../../styles'
import {Box, Meta, Text} from '../../common-adapters'
import {formatTimeForFS} from '../../util/timestamp'

type Props = {
  lastModifiedTimestamp: number,
  lastWriter: string,
  wrap?: boolean,
  startWithLastModified?: boolean,
  resetParticipants?: Array<string>,
}

const PathItemInfo = (props: Props) => (
  <Box style={props.wrap ? timeWriterBoxStyleWithWrap : timeWriterBoxStyle}>
    {!!props.resetParticipants && props.resetParticipants.length > 0
      ? (
        <Box style={resetInfoBoxStyle}>
          <Meta title="reset" backgroundColor={globalColors.red} />
          <Text type="BodySmall" lineClamp={isMobile ? 1 : undefined}>
            someone has reset their account
          </Text>
        </Box>
      )
      : (<Text type="BodySmall" lineClamp={isMobile ? 1 : undefined}>
        {(props.startWithLastModified ? 'Last modified ' : '') + formatTimeForFS(props.lastModifiedTimestamp)}
      </Text>)}
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

const resetInfoBoxStyle = {
  ...globalStyles.flexBoxRow,
  padding: 1,
}

export default PathItemInfo
