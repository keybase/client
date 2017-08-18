// @flow
import React, {PureComponent} from 'react'
import {Text, PlaintextUsernames, Box} from '../../../common-adapters'
import {globalStyles, globalColors, lineHeight} from '../../../styles'
import {isMobile} from '../../../constants/platform'
import {List} from 'immutable'

type SimpleTopLineProps = {
  hasUnread: boolean,
  participants: List<string>,
  showBold: boolean,
  subColor: ?string,
  timestamp: ?string,
  usernameColor: ?string,
}

const height = isMobile ? 19 : 17

class SimpleTopLine extends PureComponent<void, SimpleTopLineProps, void> {
  render() {
    const {hasUnread, participants, showBold, subColor, timestamp, usernameColor} = this.props
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
        {hasUnread ? <Box key="1" style={unreadDotStyle} /> : null}
      </Box>
    )
  }
}

type FilteredTopLineProps = {
  participants: List<string>,
  showBold: boolean,
  usernameColor: ?string,
}

class FilteredTopLine extends PureComponent<void, FilteredTopLineProps, void> {
  render() {
    const {participants, showBold, usernameColor} = this.props
    const boldOverride = showBold ? globalStyles.fontBold : null
    return (
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          flex: 1,
          justifyContent: 'flex-start',
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

export {SimpleTopLine, FilteredTopLine}
