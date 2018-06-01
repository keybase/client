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
  isUserReset?: boolean,
}

const fancyJoin = (arr: Array<string>, delimiter: string, doubleDelimiter: string, finalDelimiter: string): string => {
  if (arr.length === 1) {
    return arr[0]
  } else if (arr.length === 2) {
    return `${arr[0]}${doubleDelimiter}${arr[1]}`
  }
  return `${arr.slice(0, -1).join(delimiter)}${finalDelimiter}${arr[arr.length - 1]}`
}

const PathItemInfo = (props: Props) => (
  <Box style={props.wrap ? timeWriterBoxStyleWithWrap : timeWriterBoxStyle}>
    {!!props.resetParticipants && props.resetParticipants.length > 0
      ? (
        <Box style={resetInfoBoxStyle}>
          {props.isUserReset
            ? <Text type="BodyError">
                Participants have to let you back in.
              </Text>
            : <Box style={globalStyles.flexBoxRow}>
                <Meta title="reset" backgroundColor={globalColors.red} style={resetMetaStyle} />
                <Text type="BodySmall" lineClamp={isMobile ? 1 : undefined}>
                  {fancyJoin(props.resetParticipants, ', ', ' and ', ', and ')} ha{props.resetParticipants && props.resetParticipants.length === 1 ? 's' : 've'} reset their account.
                </Text>
              </Box>
          }
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
}

const resetMetaStyle = {
  marginRight: 4,
}

export default PathItemInfo
