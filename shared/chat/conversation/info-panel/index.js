// @flow
import * as React from 'react'
import {Box, Button, Divider, HeaderHoc, List, Text} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../../styles'
import {SmallTeamHeader, BigTeamHeader} from './header'
import Notifications from './notifications/container'
import {Participant} from './participant'
import {ManageTeam} from './manage-team'
import {TurnIntoTeam} from './turn-into-team'

const border = `1px solid ${globalColors.black_05}`
const listStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'stretch',
  paddingBottom: globalMargins.medium,
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

type InfoPanelProps = {
  isPreview: boolean,
  admin: boolean,
  muted: boolean,
  teamname: string,
  channelname: string,
  smallTeam: boolean,
  participants: Array<{
    username: string,
    following: boolean,
    fullname: string,
    broken: boolean,
    isYou: boolean,
  }>,

  // Used by HeaderHoc.
  onBack: () => void,

  onShowBlockConversationDialog: () => void,
  onShowNewTeamDialog: () => void,

  onShowProfile: (username: string) => void,

  onViewTeam: () => void,
  onLeaveConversation: () => void,
  onJoinChannel: () => void,
}

type ConversationFooterRow = {
  type: 'conversation footer',
  key: 'CONVERSATION FOOTER',
  onShowBlockConversationDialog: () => void,
  onShowNewTeamDialog: () => void,
}

type SmallHeaderRow = {
  type: 'small header',
  key: 'SMALL HEADER',
  admin: boolean,
  teamname: string,
  participantCount: number,
  onViewTeam: () => void,
}

type BigHeaderRow = {
  type: 'big header',
  key: 'BIG HEADER',
  admin: boolean,
  teamname: string,
  channelname: string,
  participantCount: number,
  onViewTeam: () => void,
  onJoinChannel: () => void,
  onLeaveConversation: () => void,
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

type TeamRow = ConversationFooterRow | SmallHeaderRow | BigHeaderRow | ParticipantRow
type RowType = $PropertyType<TeamRow, 'type'>

const _renderTeamRow = (i: number, props: TeamRow) => {
  switch (props.type) {
    case 'conversation footer':
      return (
        <Box key={props.key} style={{...globalStyles.flexBoxColumn, alignItems: 'stretch'}}>
          <Divider style={{marginBottom: 10, marginTop: 10}} />

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
        </Box>
      )

    case 'small header':
      return (
        <Box key={props.key} style={{...globalStyles.flexBoxColumn, alignItems: 'stretch'}}>
          <SmallTeamHeader
            teamname={props.teamname}
            participantCount={props.participantCount}
            onClick={props.onViewTeam}
          />

          <Divider style={{marginBottom: 20, marginTop: 20}} />

          <Notifications />
          <Divider style={styleDivider} />

          <ManageTeam
            canManage={props.admin}
            label="In this team"
            participantCount={props.participantCount}
            onClick={props.onViewTeam}
          />
        </Box>
      )

    case 'big header':
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
            participantCount={props.participantCount}
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

const typeSizeEstimator = (type: RowType): number => {
  // The sizes below are retrieved by using the React DevTools
  // inspector on the appropriate components, including margins.
  switch (type) {
    case 'conversation footer':
      return 444

    case 'small header':
      return 407

    case 'big header':
      return 469 // estimate based on size of header in non-admin non-preview mode
    case 'participant':
      return 56

    default:
      throw new Error('Unexpected type ' + type)
  }
}

const _InfoPanel = (props: InfoPanelProps) => {
  const participants: Array<ParticipantRow> = props.participants.map(participant => ({
    onShowProfile: props.onShowProfile,
    type: 'participant',
    participant,
    key: participant.username,
  }))

  const participantCount = participants.length

  let rows: Array<TeamRow>
  if (props.smallTeam) {
    rows = [
      ({
        ...props,
        type: 'small header',
        key: 'SMALL HEADER',
        participantCount,
      }: SmallHeaderRow),
    ].concat(participants)
  } else if (props.channelname) {
    rows = [
      ({
        ...props,
        type: 'big header',
        key: 'BIG HEADER',
        participantCount,
      }: BigHeaderRow),
    ].concat(participants)
  } else {
    rows = participants.concat(
      ({
        ...props,
        type: 'conversation footer',
        key: 'CONVERSATION FOOTER',
      }: ConversationFooterRow)
    )
  }

  const rowSizeEstimator = index => typeSizeEstimator(rows[index].type)
  return (
    <List
      items={rows}
      renderItem={_renderTeamRow}
      keyProperty="key"
      style={listStyle}
      itemSizeEstimator={rowSizeEstimator}
    />
  )
}

const InfoPanel = isMobile ? HeaderHoc(_InfoPanel) : _InfoPanel

const styleDivider = {
  marginBottom: globalMargins.small,
  marginTop: globalMargins.small,
}

export {InfoPanel}
