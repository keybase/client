// @flow
import React from 'react'
import {Avatar, Box, Text, Icon, PopupMenu} from '../../../../common-adapters'
import {
  globalStyles,
  globalColors,
  globalMargins,
  glamorous,
  isMobile,
  desktopStyles,
} from '../../../../styles'

type Props = {
  memberCount: number,
  onManageChannels: () => void,
  onSetShowMenu: boolean => void,
  onViewTeam: () => void,
  showMenu: boolean,
  teamname: string,
}

const zIndexMenu = 20

type State = {
  popTop: ?number,
}

class BigTeamHeader extends React.PureComponent<Props, State> {
  state = {
    popTop: null,
  }

  render() {
    const props = this.props

    return (
      <HeaderBox>
        <Avatar teamname={props.teamname} size={isMobile ? 24 : 16} />
        <Text type="BodySmallSemibold" style={teamStyle}>
          {props.teamname}
        </Text>
        <Icon
          className="icon"
          type="iconfont-gear"
          onClick={e => {
            if (!isMobile) {
              // $FlowIssue doesn't know about getBoundingClientRect
              const {top} = e.currentTarget.getBoundingClientRect()
              this.setState({popTop: top})
              props.onSetShowMenu(true)
            } else {
              props.onManageChannels()
            }
          }}
          style={iconStyle}
        />
        {props.showMenu && (
          <PopupMenu
            header={{
              title: 'Header',
              view: (
                <Box style={teamHeaderStyle}>
                  <Avatar teamname={props.teamname} size={16} />
                  <Text type="BodySmallSemibold" style={teamStyle}>
                    {props.teamname}
                  </Text>
                  <Text type="BodySmall">
                    {props.memberCount + ' member' + (props.memberCount !== 1 ? 's' : '')}
                  </Text>
                </Box>
              ),
            }}
            items={[
              {onClick: props.onManageChannels, title: 'Manage chat channels'},
              {onClick: props.onViewTeam, title: 'View team'},
            ]}
            onHidden={() => props.onSetShowMenu(false)}
            style={{
              position: isMobile ? 'relative' : 'absolute',
              right: globalMargins.tiny,
              top: isMobile ? globalMargins.small : this.state.popTop,
              zIndex: zIndexMenu,
            }}
            styleCatcher={{
              zIndex: 1,
            }}
          />
        )}
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
    ? {
        backgroundColor: globalColors.fastBlank,
      }
    : {
        hoverColor: globalColors.black_75,
      }),
}

const teamHeaderStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
  paddingTop: globalMargins.small,
}

const teamRowContainerStyle = {
  ...globalStyles.flexBoxRow,
  ...desktopStyles.clickable,
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
  flexGrow: 1,
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
  ...(isMobile
    ? {
        backgroundColor: globalColors.fastBlank,
      }
    : {}),
}

export {BigTeamHeader}
