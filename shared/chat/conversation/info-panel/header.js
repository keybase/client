// @flow
import * as React from 'react'
import {Avatar, Box, ClickableBox, Icon, Text} from '../../../common-adapters'
import {type FloatingMenuParentProps, FloatingMenuParentHOC} from '../../../common-adapters/floating-menu'
import InfoPanelMenu from './menu/container'
import {glamorous, globalMargins, globalStyles, isMobile} from '../../../styles'

type SmallProps = {
  teamname: string,
  participantCount: number,
  onClick: () => void,
  isSmallTeam: boolean,
} & FloatingMenuParentProps

const gearIconSize = isMobile ? 24 : 16

const _SmallTeamHeader = (props: SmallProps) => {
  return (
    <ClickableBox
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        marginLeft: globalMargins.small,
      }}
      onClick={props.onClick}
    >
      <InfoPanelMenu
        attachTo={props.attachmentRef}
        onHidden={props.toggleShowingMenu}
        isSmallTeam={props.isSmallTeam}
        teamname={props.teamname}
        visible={props.showingMenu}
      />
      <Avatar size={isMobile ? 48 : 32} teamname={props.teamname} isTeam={true} />
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, marginLeft: globalMargins.small}}>
        <Text type="BodySemibold">{props.teamname}</Text>
        <Box style={globalStyles.flexBoxRow}>
          <Text type="BodySmall">
            {props.participantCount.toString() + ' member' + (props.participantCount !== 1 ? 's' : '')}
          </Text>
        </Box>
      </Box>
      <Icon
        type="iconfont-gear"
        onClick={props.toggleShowingMenu}
        ref={props.setAttachmentRef}
        style={{marginRight: 16, width: gearIconSize, height: gearIconSize, fontSize: gearIconSize}}
      />
    </ClickableBox>
  )
}

const SmallTeamHeader = FloatingMenuParentHOC(_SmallTeamHeader)

// TODO probably factor this out into a connected component
type BigProps = {
  canEditChannel: boolean,
  channelname: string,
  description: ?string,
  teamname: string,
  onClick: () => void,
  onEditChannel: () => void,
}

const EditBox = isMobile
  ? ClickableBox
  : glamorous(ClickableBox)({
      opacity: 0,
      '.header-row:hover &': {
        opacity: 1,
      },
    })

const BigTeamHeader = (props: BigProps) => {
  return (
    <Box className="header-row" style={{...globalStyles.flexBoxColumn, alignItems: 'stretch'}}>
      <Box
        style={{alignSelf: 'center', marginTop: globalMargins.medium, marginBottom: 2, position: 'relative'}}
      >
        <Text type="BodyBig">#{props.channelname}</Text>
        {props.canEditChannel && (
          <EditBox
            style={{
              ...globalStyles.flexBoxRow,
              position: 'absolute',
              right: -50,
              top: isMobile ? 2 : 1,
            }}
            onClick={props.onEditChannel}
          >
            <Icon style={{marginRight: globalMargins.xtiny}} type="iconfont-edit" />
            <Text type="BodySmallPrimaryLink" className="hover-underline">
              Edit
            </Text>
          </EditBox>
        )}
      </Box>
      {!!props.description && (
        <Text
          style={{
            paddingLeft: 4,
            paddingRight: 4,
            textAlign: 'center',
          }}
          type="Body"
        >
          {props.description}
        </Text>
      )}
    </Box>
  )
}

export {SmallTeamHeader, BigTeamHeader}
