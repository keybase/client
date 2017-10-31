// @flow
import React, {PureComponent} from 'react'
import {Avatar, Box, Text, Icon, PopupMenu} from '../../../../common-adapters'
import {globalStyles, globalColors, globalMargins, glamorous} from '../../../../styles'
import {isMobile} from '../../../../constants/platform'

type Props = {
  memberCount: number,
  onSetShowMenu: boolean => void,
  showMenu: boolean,
  teamname: string,
}

class BigTeamHeader extends PureComponent<Props> {
  render() {
    return (
      <HeaderBox>
        <Avatar teamname={this.props.teamname} size={isMobile ? 24 : 16} />
        <Text type="BodySmallSemibold" style={teamStyle}>
          {this.props.teamname}
        </Text>
        <Icon
          className="icon"
          type="iconfont-gear"
          onClick={() => this.props.onSetShowMenu(true)}
          style={iconStyle}
        />
        {this.props.showMenu &&
          <PopupMenu
            header={{
              title: 'Header',
              view: (
                <Box style={teamHeaderStyle}>
                  <Avatar teamname={this.props.teamname} size={16} />
                  <Text type="BodySmallSemibold" style={teamStyle}>{this.props.teamname}</Text>
                  <Text type="BodySmall">
                    {this.props.memberCount + ' member' + (this.props.memberCount !== 1 ? 's' : '')}
                  </Text>
                </Box>
              ),
            }}
            items={[
              {onClick: this.props.onManageChannels, title: 'Manage chat channels'},
              {onClick: this.props.onViewTeam, title: 'View team'},
            ]}
            onHidden={() => this.props.onSetShowMenu(false)}
            style={{
              position: isMobile ? 'relative' : 'absolute',
              right: globalMargins.tiny,
              top: globalMargins.small,
              zIndex: 20,
            }}
          />}
      </HeaderBox>
    )
  }
}

const iconStyle = {
  color: globalColors.black_20,
  fontSize: isMobile ? 20 : 16,
  padding: isMobile ? 8 : 4,
  paddingRight: isMobile ? 2 : 4,
  ...(isMobile
    ? {}
    : {
        hoverColor: globalColors.black_75,
      }),
}

const teamHeaderStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
  padding: globalMargins.tiny,
}

const teamRowContainerStyle = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  alignItems: 'center',
  flexShrink: 0,
  maxHeight: isMobile ? globalMargins.large : globalMargins.medium,
  minHeight: isMobile ? globalMargins.large : globalMargins.medium,
  paddingLeft: globalMargins.tiny,
  paddingRight: isMobile ? globalMargins.tiny : globalMargins.xtiny,
  position: 'relative',
}

const HeaderBox = glamorous(Box)({
  ...teamRowContainerStyle,
  ...(isMobile
    ? {}
    : {
        '& .icon': {
          display: 'none !important',
        },
        ':hover .icon': {
          display: 'inherit !important',
        },
      }),
})

const teamStyle = {
  color: globalColors.darkBlue,
  flex: 1,
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
}

export {BigTeamHeader}
