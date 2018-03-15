// @flow
import * as React from 'react'
import shallowEqual from 'shallowequal'
import {Text, PlaintextUsernames, Box} from '../../../../common-adapters'
import {globalStyles, globalColors, isMobile, platformStyles} from '../../../../styles'

type Props = {
  hasUnread: boolean,
  participants: Array<string>,
  showBold: boolean,
  backgroundColor: ?string,
  subColor: string,
  timestamp: ?string,
  usernameColor: ?string,
  hasBadge: boolean,
}

const height = isMobile ? 19 : 17

class SimpleTopLine extends React.Component<Props> {
  shouldComponentUpdate(nextProps: Props) {
    return !shallowEqual(this.props, nextProps, (obj, oth, key) => {
      if (key === 'participants') {
        return shallowEqual(this.props.participants, nextProps.participants)
      }

      return undefined
    })
  }

  render() {
    const {participants, showBold, subColor, timestamp, usernameColor, hasBadge, backgroundColor} = this.props
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
              containerStyle={{
                ...boldOverride,
                color: usernameColor,
                paddingRight: 7,
                ...(isMobile
                  ? {
                      backgroundColor,
                    }
                  : {}),
              }}
              users={participants.map(p => ({username: p}))}
              title={participants.join(', ')}
            />
          </Box>
        </Box>
        <Text
          key="0"
          type="BodySmall"
          style={platformStyles({
            common: {...boldOverride, color: subColor, lineHeight: height, backgroundColor},
          })}
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
