// @flow
import React, {PureComponent} from 'react'
import {Text, Usernames, Box} from '../../../common-adapters'
import {globalStyles, globalColors, lineHeight} from '../../../styles'
import {isMobile} from '../../../constants/platform'
import {List} from 'immutable'

type TopLineProps = {
  filter: string,
  hasUnread: boolean,
  participants: List<string>,
  teamname: ?string,
  showBold: boolean,
  subColor: ?string,
  timestamp: ?string,
  usernameColor: ?string,
}

class TopLine extends PureComponent<void, TopLineProps, void> {
  render() {
    const {
      filter,
      hasUnread,
      showBold,
      participants,
      subColor,
      timestamp,
      usernameColor,
      teamname,
    } = this.props
    const height = isMobile ? 19 : 17
    const boldOverride = showBold ? globalStyles.fontBold : null
    let details = []
    if (!filter) {
      details = [
        <Text
          key="0"
          type="BodySmall"
          style={{...boldOverride, color: subColor, lineHeight: lineHeight(height)}}
        >
          {timestamp}
        </Text>,
      ]
      if (hasUnread) {
        details.push(<Box key="1" style={unreadDotStyle} />)
      }
    }
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
            <Usernames
              inline={true}
              plainText={true}
              type="BodySemibold"
              plainDivider={isMobile ? undefined : ',\u200a'}
              containerStyle={{...boldOverride, color: usernameColor, paddingRight: 7}}
              users={teamname ? [{username: teamname}] : participants.map(p => ({username: p})).toArray()}
              title={teamname || participants.join(', ')}
            />
          </Box>
        </Box>
        {details}
      </Box>
    )
  }
}

const unreadDotStyle = {
  backgroundColor: globalColors.orange,
  borderRadius: 3,
  height: 6,
  marginLeft: 4,
  width: 6,
}

export default TopLine
