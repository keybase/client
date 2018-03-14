// @flow
import * as React from 'react'
import {Avatar, Box, ClickableBox, Icon, Text} from '../../../common-adapters'
import {glamorous, globalMargins, globalStyles, isMobile} from '../../../styles'

type SmallProps = {
  teamname: string,
  participantCount: number,
  onClick: () => void,
  onClickGear: (?Element) => void,
}

const gearIconSize = isMobile ? 24 : 16

const SmallTeamHeader = ({teamname, participantCount, onClick, onClickGear}: SmallProps) => {
  const _onClick = (evt: SyntheticEvent<Element>) => {
    if (!evt.defaultPrevented) {
      onClick()
    }
  }
  const _onClickGear = (evt: SyntheticEvent<Element>) => {
    evt.preventDefault()
    if (!isMobile) {
      onClickGear(evt.currentTarget)
    } else {
      onClickGear()
    }
  }
  return (
    <ClickableBox
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        marginLeft: globalMargins.small,
      }}
      // $FlowIssue with ClickableBox
      onClick={_onClick}
    >
      <Avatar size={isMobile ? 48 : 32} teamname={teamname} isTeam={true} />
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, marginLeft: globalMargins.small}}>
        <Text type="BodySemibold">{teamname}</Text>
        <Box style={globalStyles.flexBoxRow}>
          <Text type="BodySmall">
            {participantCount.toString() + ' member' + (participantCount !== 1 ? 's' : '')}
          </Text>
        </Box>
      </Box>
      <Icon
        type="iconfont-gear"
        // $FlowIssue with ClickableBox
        onClick={_onClickGear}
        style={{marginRight: 16, width: gearIconSize, height: gearIconSize, fontSize: gearIconSize}}
      />
    </ClickableBox>
  )
}

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
