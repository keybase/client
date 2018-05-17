// @flow
import * as React from 'react'
import shallowEqual from 'shallowequal'
import {Text, PlaintextUsernames, Box, Icon} from '../../../../common-adapters'
import {FloatingMenuParentHOC, type FloatingMenuParentProps} from '../../../../common-adapters/floating-menu'
import TeamMenu from '../../../conversation/info-panel/menu/container'
import {globalStyles, globalColors, globalMargins, isMobile, platformStyles} from '../../../../styles'

type Props = {
  hasUnread: boolean,
  iconHoverColor: string,
  participants: Array<string>,
  showBold: boolean,
  showGear: boolean,
  backgroundColor: ?string,
  subColor: string,
  timestamp: ?string,
  usernameColor: ?string,
  hasBadge: boolean,
} & FloatingMenuParentProps

class _SimpleTopLine extends React.Component<Props> {
  shouldComponentUpdate(nextProps: Props) {
    return !shallowEqual(this.props, nextProps, (obj, oth, key) => {
      if (key === 'participants') {
        return shallowEqual(this.props.participants, nextProps.participants)
      }

      return undefined
    })
  }

  render() {
    const boldOverride = this.props.showBold ? globalStyles.fontBold : null
    return (
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          flexGrow: 1,
          height: isMobile ? 20 : 17,
          maxHeight: isMobile ? 20 : 17,
        }}
      >
        {this.props.showGear && (
          <TeamMenu
            visible={this.props.showingMenu}
            attachTo={this.props.attachmentRef}
            onHidden={this.props.toggleShowingMenu}
            isSmallTeam={true}
            teamname={(this.props.participants.length && this.props.participants[0]) || ''}
          />
        )}
        <Box
          style={{
            ...globalStyles.flexBoxRow,
            flexGrow: 1,
            height: '100%',
            position: 'relative',
          }}
        >
          <Box
            style={{
              ...globalStyles.flexBoxColumn,
              ...globalStyles.fillAbsolute,
              justifyContent: 'center',
            }}
          >
            <PlaintextUsernames
              type="BodySemibold"
              containerStyle={{
                ...boldOverride,
                color: this.props.usernameColor,
                paddingRight: 7,
                ...(isMobile
                  ? {
                      backgroundColor: this.props.backgroundColor,
                    }
                  : {}),
              }}
              users={this.props.participants.map(p => ({username: p}))}
              title={this.props.participants.join(', ')}
            />
          </Box>
        </Box>
        <Text
          key="0"
          type="BodySmall"
          className={this.props.showGear ? 'small-team-timestamp' : undefined}
          style={platformStyles({
            common: {
              ...boldOverride,
              backgroundColor: this.props.backgroundColor,
              color: this.props.subColor,
            },
          })}
        >
          {this.props.timestamp}
        </Text>
        {this.props.showGear && (
          <Icon
            type="iconfont-gear"
            className="small-team-gear"
            onClick={this.props.toggleShowingMenu}
            ref={this.props.setAttachmentRef}
            color={this.props.subColor}
            fontSize={14}
            hoverColor={this.props.iconHoverColor}
            style={{position: 'relative', right: globalMargins.xtiny}}
          />
        )}
        {this.props.hasBadge ? <Box key="1" style={unreadDotStyle} /> : null}
      </Box>
    )
  }
}
const SimpleTopLine = FloatingMenuParentHOC(_SimpleTopLine)

const unreadDotStyle = {
  backgroundColor: globalColors.orange,
  borderRadius: 6,
  height: 8,
  marginLeft: 4,
  width: 8,
}

export {SimpleTopLine}
