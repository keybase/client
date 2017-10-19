// @flow
import React, {PureComponent} from 'react'
import {Text, PlaintextUsernames, Box} from '../../../../common-adapters'
import {globalStyles, globalColors, lineHeight} from '../../../../styles'
import {isMobile} from '../../../../constants/platform'
import {List} from 'immutable'

type Props = {
  hasUnread: boolean,
  participants: List<string>,
  showBold: boolean,
  subColor: ?string,
  timestamp: ?string,
  usernameColor: ?string,
  hasBadge: boolean,
}

const height = isMobile ? 19 : 17

class SimpleTopLine extends PureComponent<Props> {
  render() {
    const {participants, showBold, subColor, timestamp, usernameColor, hasBadge} = this.props
    const boldOverride = showBold ? globalStyles.fontBold : null
    return (
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', maxHeight: height, minHeight: height}}>
        <Box
          style={{
            ...globalStyles.flexBoxRow,
            flex: 1,
            maxHeight: height,
            minHeight: height,
            position: 'relative',
          }}
        >
          <Box
            style={{
              ...globalStyles.flexBoxColumn,
              bottom: 0,
              justifyContent: 'flex-start',
              left: 0,
              position: 'absolute',
              right: 0,
              top: 0,
            }}
          >
            <PlaintextUsernames
              type="BodySemibold"
              containerStyle={{...boldOverride, color: usernameColor, paddingRight: 7}}
              users={participants.map(p => ({username: p})).toArray()}
              title={participants.join(', ')}
            />
          </Box>
        </Box>
        <Text
          key="0"
          type="BodySmall"
          style={{...boldOverride, color: subColor, lineHeight: lineHeight(height)}}
        >
          {timestamp}
        </Text>
        {hasBadge ? <Box key="1" style={unreadDotStyle} /> : null}
      </Box>
    )
  }
}

const unreadDotStyle = {
  backgroundColor: globalColors.orange,
  borderRadius: 6,
  height: 8,
  marginLeft: 4,
  width: 8,
}

export {SimpleTopLine}
