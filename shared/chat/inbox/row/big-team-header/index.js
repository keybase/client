// @flow
import React, {PureComponent} from 'react'
import {Avatar, Box, Text, Icon, PopupMenu} from '../../../../common-adapters'
import {globalStyles, globalColors, globalMargins, glamorous} from '../../../../styles'
import {isMobile} from '../../../../constants/platform'

type Props = {
  teamname: string,
  onShowMenu: () => void,
}

class BigTeamHeader extends PureComponent<Props> {
  render() {
    console.warn('in render props are', this.props, this.props.showMenu)
    const onManageChat = () => {}
    const onLeaveTeam = () => {}
    return (
      <HeaderBox>
        <Avatar teamname={this.props.teamname} size={isMobile ? 24 : 16} />
        <Text type="BodySmallSemibold" style={teamStyle}>{this.props.showMenu ? 'showing' : ''} {this.props.teamname}</Text>
        <Icon className="icon" type="iconfont-gear" onClick={this.props.onShowMenu} style={iconStyle} />
        {this.props.showMenu &&
          <PopupMenu
            items={[
              {onClick: onManageChat, title: 'Manage chat channels'},
              {onClick: onLeaveTeam, title: 'Leave team', danger: true},
            ]}
            onHidden={() => this.props.setShowMenu(false)}
            style={{position: 'relative', right: globalMargins.tiny, top: globalMargins.tiny}}
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

const teamRowContainerStyle = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  alignItems: 'center',
  flexShrink: 0,
  maxHeight: isMobile ? globalMargins.large : globalMargins.medium,
  minHeight: isMobile ? globalMargins.large : globalMargins.medium,
  paddingLeft: globalMargins.tiny,
  paddingRight: isMobile ? globalMargins.tiny : globalMargins.xtiny,
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
