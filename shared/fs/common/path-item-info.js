// @flow
import * as React from 'react'
import {globalStyles, globalColors, isMobile, platformStyles} from '../../styles'
import {Box, Meta, Text, ConnectedUsernames} from '../../common-adapters'
import {formatTimeForFS} from '../../util/timestamp'

// TODO: this thing should probably get its own container, so we don't have to
// derive lastModifiedTimestamp, lastWriter, resetParticipants, isUserReset
// everwhere.

type Props = {
  lastModifiedTimestamp?: number,
  lastWriter?: string,
  wrap?: boolean,
  startWithLastModified?: boolean,
  resetParticipants?: Array<string>,
  isUserReset?: boolean,
}

const fancyJoin = (
  names: Array<string>,
  delimiter: string,
  doubleDelimiter: string,
  finalDelimiter: string
): string => {
  if (names.length === 1) {
    return names[0]
  } else if (names.length === 2) {
    return `${names[0]}${doubleDelimiter}${names[1]}`
  }
  return `${names.slice(0, -1).join(delimiter)}${finalDelimiter}${names[names.length - 1]}`
}

const PathItemInfo = (props: Props) => (
  <Box style={props.wrap ? timeWriterBoxStyleWithWrap : timeWriterBoxStyle}>
    {!!props.resetParticipants && props.resetParticipants.length > 0 ? (
      <Box style={resetInfoBoxStyle}>
        {props.isUserReset ? (
          <Text type="BodySmallError">Participants have to let you back in.</Text>
        ) : (
          <Box style={globalStyles.flexBoxRow}>
            <Meta title="reset" backgroundColor={globalColors.red} style={resetMetaStyle} />
            <Text type="BodySmall" lineClamp={isMobile ? 1 : undefined}>
              {fancyJoin(props.resetParticipants, ', ', ' and ', ', and ')} ha
              {props.resetParticipants && props.resetParticipants.length === 1 ? 's' : 've'} reset their
              account
              {props.resetParticipants && props.resetParticipants.length > 1 && 's'}.
            </Text>
          </Box>
        )}
      </Box>
    ) : (
      !!props.lastModifiedTimestamp && (
        <Text type="BodySmall" lineClamp={isMobile ? 1 : undefined}>
          {(props.startWithLastModified ? 'Last modified ' : '') +
            formatTimeForFS(props.lastModifiedTimestamp, !!props.startWithLastModified)}
        </Text>
      )
    )}
    {props.lastWriter ? (
      <Text type="BodySmall" style={writerTextStyle} lineClamp={isMobile ? 1 : undefined}>
        &nbsp;by&nbsp;
        <ConnectedUsernames
          type="BodySmallSecondaryLink"
          usernames={[props.lastWriter]}
          inline={true}
          onUsernameClicked="profile"
          underline={true}
        />
      </Text>
    ) : (
      undefined
    )}
  </Box>
)

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
