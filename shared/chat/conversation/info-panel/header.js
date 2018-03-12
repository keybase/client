// @flow
import * as React from 'react'
import {Avatar, Box, Button, ClickableBox, Icon, Text} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../../styles'

type SmallProps = {
  teamname: string,
  participantCount: number,
  onClick: () => void,
  onClickGear: () => void,
}

const gearIconSize = isMobile ? 24 : 16

const SmallTeamHeader = ({canManage, teamname, participantCount, onClick, onClickGear}: SmallProps) => (
  <ClickableBox
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      marginLeft: globalMargins.small,
    }}
    onClick={evt => !evt.defaultPrevented && onClick()}
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
      onClick={evt => {
        evt.preventDefault()
        onClickGear()
      }}
      style={{marginRight: 16, width: gearIconSize, height: gearIconSize, fontSize: gearIconSize}}
    />
  </ClickableBox>
)

type BigProps = {
  channelname: string,
  description: ?string,
  teamname: string,
  isPreview: boolean,
  onJoinOrLeave: () => void,
  onClick: () => void,
}

const BigTeamHeader = (props: BigProps) => {
  return (
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'stretch'}}>
      <Text style={{alignSelf: 'center', marginTop: globalMargins.medium, marginBottom: 2}} type="BodyBig">
        #{props.channelname}
      </Text>
      {props.description && (
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
      {props.isPreview && <Button type="Primary" label="Join channel" onClick={props.onJoinOrLeave} />}
      {!props.isPreview &&
        props.channelname !== 'general' && (
          <Box
            style={{
              ...globalStyles.flexBoxRow,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: globalMargins.small,
            }}
            onClick={props.onJoinOrLeave}
          >
            <Icon
              type="iconfont-team-leave"
              style={{color: globalColors.red, marginRight: globalMargins.tiny}}
            />
            <Text type="BodySemibold" style={{color: globalColors.red}}>
              Leave channel
            </Text>
          </Box>
        )}
    </Box>
  )
}

export {SmallTeamHeader, BigTeamHeader}
