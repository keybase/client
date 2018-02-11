// @flow
import * as React from 'react'
import {Box, Button, Divider, HeaderHoc, List, ScrollView, Text} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../../styles'
import {SmallTeamHeader, BigTeamHeader} from './header'
import Notifications from './notifications/container'
import Participants, {Participant} from './participants'
import {ManageTeam} from './manage-team'
import {TurnIntoTeam} from './turn-into-team'

const border = `1px solid ${globalColors.black_05}`
const scrollViewStyle = {
  flex: 1,
  ...(isMobile
    ? {}
    : {
        backgroundColor: globalColors.white,
        borderLeft: border,
        borderRight: border,
        marginTop: -1 /* Necessary fix: adds 1px at the top so we hide the gray divider */,
      }),
}
const contentContainerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'stretch',
  paddingBottom: globalMargins.medium,
}

type infoPanelProps = {
  admin: boolean,
  muted: boolean,
  onMuteConversation: (muted: boolean) => void,
  onShowProfile: (username: string) => void,
  onToggleInfoPanel: () => void,
  participants: Array<{
    username: string,
    following: boolean,
    fullname: string,
    broken: boolean,
    isYou: boolean,
  }>,
}

type ConversationInfoPanelProps = infoPanelProps & {
  onShowBlockConversationDialog: () => void,
  onShowNewTeamDialog: () => void,
}

const _ConversationInfoPanel = (props: ConversationInfoPanelProps) => (
  <ScrollView style={scrollViewStyle} contentContainerStyle={contentContainerStyle}>
    <Participants participants={props.participants} onShowProfile={props.onShowProfile} />

    <Divider style={{marginBottom: 20, marginTop: 10}} />

    <TurnIntoTeam onClick={props.onShowNewTeamDialog} />

    <Divider style={styleDivider} />

    <Notifications />

    <Divider style={styleDivider} />

    <Button
      type="Danger"
      small={true}
      label="Block this conversation"
      onClick={props.onShowBlockConversationDialog}
    />
  </ScrollView>
)

type SmallTeamInfoPanelProps = infoPanelProps & {
  onLeaveTeam: () => void,
  onViewTeam: () => void,
  teamname: string,
}

// TODO put leave team button back in once bugs are fixed
// const headerButtonBoxStyle = {
//   ...globalStyles.flexBoxRow,
//   alignItems: 'center',
//   alignSelf: 'center',
// }

// const createIconStyle = {
//   color: globalColors.red,
//   fontSize: isMobile ? 20 : 16,
// }

const _SmallTeamInfoPanel = (props: SmallTeamInfoPanelProps) => (
  <ScrollView style={scrollViewStyle} contentContainerStyle={contentContainerStyle}>
    <SmallTeamHeader
      teamname={props.teamname}
      participantCount={props.participants.length}
      onClick={props.onViewTeam}
    />

    <Divider style={{marginBottom: 20, marginTop: 20}} />

    <Notifications />
    {/* <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'flex-end'}}>
      <Divider style={styleDivider} />
      <ClickableBox onClick={props.onLeaveTeam} style={headerButtonBoxStyle}>
        <Icon type="iconfont-team-leave" style={createIconStyle} />
        <Text type="BodyBigLink" style={{margin: globalMargins.xtiny, color: globalColors.red}}>
          Leave team
        </Text>
      </ClickableBox>
    </Box> */}
    <Divider style={styleDivider} />

    <ManageTeam
      canManage={props.admin}
      label="In this team"
      participantCount={props.participants.length}
      onClick={props.onViewTeam}
    />

    <Participants participants={props.participants} onShowProfile={props.onShowProfile} />
  </ScrollView>
)

type BigTeamInfoPanelProps = infoPanelProps & {
  onLeaveConversation: () => void,
  channelname: string,
  onJoinChannel: () => void,
  onViewTeam: () => void,
  teamname: string,
  isPreview: boolean,
}

type HeaderRow = BigTeamInfoPanelProps & {
  type: 'header',
  key: 'HEADER',
}

type ParticipantRow = {
  type: 'participant',
  participant: {
    username: string,
    following: boolean,
    fullname: string,
    broken: boolean,
    isYou: boolean,
  },
  onShowProfile: string => void,
  key: string,
}

type BigTeamRow = HeaderRow | ParticipantRow
// For virtualizing big team participants list
const _renderBigTeamRow = (i: number, props: BigTeamRow) => {
  switch (props.type) {
    case 'header':
      return (
        <Box key={props.key} style={{...globalStyles.flexBoxColumn, alignItems: 'stretch'}}>
          <BigTeamHeader
            channelname={props.channelname}
            teamname={props.teamname}
            onClick={props.onViewTeam}
          />

          {!props.isPreview && (
            <Box>
              <Divider style={styleDivider} />
              <Notifications />
            </Box>
          )}

          <Divider style={styleDivider} />

          <Box style={{...globalStyles.flexBoxRow, justifyContent: 'center'}}>
            {props.isPreview && (
              <Button
                type="Primary"
                label="Join channel"
                style={{marginRight: globalMargins.xtiny}}
                small={true}
                onClick={props.onJoinChannel}
              />
            )}
            {!props.isPreview && (
              <Button type="Danger" small={true} label="Leave channel" onClick={props.onLeaveConversation} />
            )}
          </Box>

          {props.isPreview && (
            <Text type="BodySmall" style={{textAlign: 'center', marginTop: globalMargins.xtiny}}>
              Anyone in {props.teamname} can join.
            </Text>
          )}

          <Divider style={styleDivider} />

          <ManageTeam
            canManage={props.admin && props.channelname === 'general'}
            label="In this channel"
            participantCount={props.participants.length}
            onClick={props.onViewTeam}
          />
        </Box>
      )
    case 'participant':
      return (
        <Participant key={props.key} participant={props.participant} onShowProfile={props.onShowProfile} />
      )

    default:
      throw new Error('Unexpected type ' + props.type)
  }
}

const _BigTeamInfoPanel = (props: BigTeamInfoPanelProps) => {
  const rows: Array<BigTeamRow> = [
    {
      ...props,
      type: 'header',
      key: 'HEADER',
    },
  ]
  props.participants.forEach(participant =>
    rows.push({
      onShowProfile: props.onShowProfile,
      type: 'participant',
      participant,
      key: participant.username,
    })
  )

  const rowSizeEstimator = index => {
    const type = rows[index].type
    switch (type) {
      case 'header':
        return 469 // estimate based on size of header in non-admin non-preview mode
      case 'participant':
        return 56

      default:
        throw new Error('Unexpected type ' + type)
    }
  }

  return (
    <List
      items={rows}
      renderItem={_renderBigTeamRow}
      keyProperty="key"
      style={{
        ...contentContainerStyle,
        ...scrollViewStyle,
      }}
      itemSizeEstimator={rowSizeEstimator}
    />
  )
}

const wrap = x => (isMobile ? HeaderHoc(x) : x)
const ConversationInfoPanel = wrap(_ConversationInfoPanel)
const SmallTeamInfoPanel = wrap(_SmallTeamInfoPanel)
const BigTeamInfoPanel = wrap(_BigTeamInfoPanel)

const styleDivider = {
  marginBottom: globalMargins.small,
  marginTop: globalMargins.small,
}

export {ConversationInfoPanel, SmallTeamInfoPanel, BigTeamInfoPanel}
