// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Flow from '../../../util/flow'
import {Box, Divider, HeaderOnMobile, List} from '../../../common-adapters'
import type {Props as HeaderHocProps} from '../../../common-adapters/header-hoc/types'
import {globalColors, globalMargins, globalStyles, isMobile, platformStyles} from '../../../styles'
import {SmallTeamHeader, BigTeamHeader} from './header'
import Notifications from './notifications/container'
import AddPeople from './add-people'
import Participant from './participant'
import {ParticipantCount} from './participant-count'
import {CaptionedButton, CaptionedDangerIcon} from './channel-utils'
import RetentionPicker from '../../../teams/team/settings-tab/retention/container'
import MinWriterRole from './min-writer-role/container'

const border = `1px solid ${globalColors.black_10}`
const listStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'stretch',
  flex: 1,
  paddingBottom: globalMargins.medium,
  ...(isMobile
    ? {}
    : {
        backgroundColor: globalColors.white,
        borderLeft: border,
        marginTop: -4 /* Necessary fix: adds 1px at the top so we hide the gray divider */,
      }),
}
const styleTurnIntoTeam = {
  padding: globalMargins.small,
}
const Spacer = ({height}: {height: number}) => <Box style={{height, width: 1}} />

type InfoPanelProps = {|
  selectedConversationIDKey: Types.ConversationIDKey,
  participants: Array<{
    username: string,
    fullname: string,
    isAdmin: boolean,
    isOwner: boolean,
  }>,
  isPreview: boolean,
  teamname: ?string,
  channelname: ?string,
  smallTeam: boolean,
  admin: boolean,
  ignored: boolean,
  spinnerForHide: boolean,

  // Used by HeaderHoc.
  onBack: () => void,

  // Used by Participant.
  onShowProfile: (username: string) => void,

  // Used for conversations.
  onShowBlockConversationDialog: () => void,
  onShowClearConversationDialog: () => void,
  onShowNewTeamDialog: () => void,
  onHideConv: () => void,
  onUnhideConv: () => void,

  // Used for small and big teams.
  canSetMinWriterRole: boolean,
  canSetRetention: boolean,

  // Used for big teams.
  canEditChannel: boolean,
  canDeleteHistory: boolean,
  description: ?string,
  onEditChannel: () => void,
  onLeaveConversation: () => void,
  onJoinChannel: () => void,
  ...$Exact<HeaderHocProps>,
|}

// FYI: Don't add a property of type ConversationIDKey to one of these rows or flow will explode
// use this.props in _renderRow instead

type AddPeopleRow = {
  type: 'add people',
  key: 'add people',
  teamname: string,
  isAdmin: boolean,
  isGeneralChannel: boolean,
}

type ParticipantRow = {|
  type: 'participant',
  key: string,
  username: string,
  fullname: string,
  isAdmin: boolean,
  isOwner: boolean,
  onShowProfile: string => void,
|}

type DividerRow = {
  type: 'divider',
  key: string,
  marginTop?: number,
  marginBottom?: number,
}

const getDividerStyle = (row: DividerRow) => ({
  marginBottom: 'marginBottom' in row ? row.marginBottom : globalMargins.small,
  marginTop: 'marginTop' in row ? row.marginTop : globalMargins.small,
})

type RetentionRow = {
  type: 'retention',
  key: 'retention',
  teamname?: string,
  canSetRetention: boolean, // used only for item size estimator
  // this should match RetentionEntityType from team/settings/retention/container
  // setting it explicity causes flow to be unable to resolve these row types
  entityType: 'adhoc' | 'channel' | 'small team' | 'big team',
}

const retentionStyles = {
  containerStyle: platformStyles({
    common: {
      paddingLeft: 16,
      paddingRight: 16,
    },
    isMobile: {
      marginRight: 16,
    },
  }),
  dropdownStyle: platformStyles({
    isElectron: {
      marginRight: 45 - 16,
      width: 'auto',
    },
    isMobile: {
      width: '100%',
    },
  }),
}

type SpacerRow = {
  type: 'spacer',
  key: string,
  height: number,
}

type NotificationsRow = {
  type: 'notifications',
  key: 'notifications',
}

type TurnIntoTeamRow = {
  type: 'turn into team',
  key: 'turn into team',
  onShowNewTeamDialog: () => void,
}

type BlockThisConversationRow = {
  type: 'block this conversation',
  key: 'block this conversation',
  onShowBlockConversationDialog: () => void,
}

type ClearThisConversationRow = {
  type: 'clear entire conversation',
  key: 'clear entire conversation',
  onShowClearConversationDialog: () => void,
}

type HideThisConversationRow = {
  type: 'hide this conversation',
  key: 'hide this conversation',
  onHideConv: () => void,
}

type UnhideThisConversationRow = {
  type: 'unhide this conversation',
  key: 'unhide this conversation',
  onUnhideConv: () => void,
}

type ParticipantCountRow = {
  type: 'participant count',
  key: 'participant count',
  label: string,
  participantCount: number,
}

type SmallTeamHeaderRow = {
  type: 'small team header',
  key: 'small team header',
  isSmallTeam: boolean,
  teamname: string,
  participantCount: number,
}

type BigTeamHeaderRow = {
  type: 'big team header',
  key: 'big team header',
  canEditChannel: boolean,
  onEditChannel: () => void,
  description: ?string,
  teamname: string,
  channelname: string,
}

type JoinChannelRow = {
  type: 'join channel',
  key: 'join channel',
  teamname: string,
  onJoinChannel: () => void,
}

type LeaveChannelRow = {
  type: 'leave channel',
  key: 'leave channel',
  onLeaveConversation: () => void,
}

type MinWriterRoleRow = {
  type: 'min writer role',
  key: 'min writer role',
  canSetMinWriterRole: boolean,
  isSmallTeam: boolean,
}

// All the row types that can appear in a small or big team header.
type TeamHeaderRow =
  | DividerRow
  | SpacerRow
  | NotificationsRow
  | ParticipantCountRow
  | RetentionRow
  | ClearThisConversationRow
  | HideThisConversationRow
  | UnhideThisConversationRow
  | SmallTeamHeaderRow
  | BigTeamHeaderRow
  | JoinChannelRow
  | LeaveChannelRow
  | MinWriterRoleRow
  | AddPeopleRow

type Row =
  | ParticipantRow
  | SpacerRow
  | DividerRow
  | NotificationsRow
  | TurnIntoTeamRow
  | ClearThisConversationRow
  | BlockThisConversationRow
  | HideThisConversationRow
  | UnhideThisConversationRow
  | TeamHeaderRow

const typeSizeEstimator = (row: Row): number => {
  // Don't bother adding more estimates to this.
  // Early items in the list get sized as soon as they render anyways.
  // This estimate is useful mostly for off-screen items (like the participants).
  if (row.type === 'participant') {
    return 56
  }

  return 0
}

class _InfoPanel extends React.Component<InfoPanelProps> {
  _renderRow = (i: number, row: Row): React.Node => {
    switch (row.type) {
      case 'add people':
        return (
          <AddPeople
            key="add people"
            isAdmin={row.isAdmin}
            isGeneralChannel={row.isGeneralChannel}
            teamname={row.teamname}
            conversationIDKey={this.props.selectedConversationIDKey}
          />
        )
      case 'participant':
        return <Participant key={`participant ${row.key}`} {...row} />

      case 'divider':
        // This wrapper is used here with flex so that the margins
        // do not collapse and the height can be calculated properly
        return (
          <Box style={{display: 'flex'}}>
            <Divider key={`divider ${row.key}`} style={getDividerStyle(row)} />
          </Box>
        )

      case 'spacer':
        return <Spacer height={row.height} key={`spacer ${row.key}`} />

      case 'notifications':
        return <Notifications key="notifications" conversationIDKey={this.props.selectedConversationIDKey} />

      case 'turn into team':
        return (
          <CaptionedButton
            caption="You'll be able to add and delete members as you wish."
            key="turn into team"
            label="Turn into team"
            onClick={row.onShowNewTeamDialog}
            style={styleTurnIntoTeam}
          />
        )

      case 'block this conversation':
        return (
          <CaptionedDangerIcon
            key="block this conversation"
            caption="Block this conversation"
            onClick={row.onShowBlockConversationDialog}
            icon="iconfont-remove"
          />
        )

      case 'clear entire conversation':
        return (
          <CaptionedDangerIcon
            key="clear entire conversation"
            caption="Clear entire conversation"
            onClick={row.onShowClearConversationDialog}
            icon="iconfont-fire"
          />
        )

      case 'hide this conversation':
        return (
          <CaptionedDangerIcon
            key="hide this conversation"
            caption="Hide this conversation"
            onClick={row.onHideConv}
            noDanger={true}
            icon="iconfont-remove"
            spinner={this.props.spinnerForHide}
          />
        )

      case 'unhide this conversation':
        return (
          <CaptionedDangerIcon
            key="unhide this conversation"
            caption="Unhide this conversation"
            onClick={row.onUnhideConv}
            noDanger={true}
            spinner={this.props.spinnerForHide}
          />
        )

      case 'participant count':
        return (
          <ParticipantCount
            key="participant count"
            label={row.label}
            participantCount={row.participantCount}
          />
        )

      case 'small team header':
        return (
          <SmallTeamHeader
            key="small team header"
            teamname={row.teamname}
            conversationIDKey={this.props.selectedConversationIDKey}
            isSmallTeam={row.isSmallTeam}
            participantCount={row.participantCount}
          />
        )

      case 'big team header':
        return (
          <BigTeamHeader
            key="big team header"
            canEditChannel={row.canEditChannel}
            onEditChannel={row.onEditChannel}
            channelname={row.channelname}
            description={row.description}
            teamname={row.teamname}
          />
        )

      case 'join channel':
        return (
          <CaptionedButton
            caption={`Anyone in ${row.teamname} can join.`}
            key="join channel"
            label="Join channel"
            onClick={row.onJoinChannel}
            waitOnClick={true}
          />
        )

      case 'leave channel':
        return (
          <CaptionedDangerIcon
            key="leave channel"
            onClick={row.onLeaveConversation}
            caption="Leave channel"
            icon="iconfont-leave"
          />
        )

      case 'retention':
        return (
          <RetentionPicker
            key="retention"
            containerStyle={retentionStyles.containerStyle}
            conversationIDKey={
              ['adhoc', 'channel'].includes(row.entityType) ? this.props.selectedConversationIDKey : undefined
            }
            dropdownStyle={retentionStyles.dropdownStyle}
            entityType={row.entityType}
            showSaveIndicator={true}
            teamname={row.teamname}
            type="auto"
          />
        )

      case 'min writer role':
        return (
          <MinWriterRole
            key="min writer role"
            conversationIDKey={this.props.selectedConversationIDKey}
            isSmallTeam={row.isSmallTeam}
          />
        )

      default:
        Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(row.type)
        throw new Error(`Impossible case encountered: ${row.type}`)
    }
  }

  render() {
    // Desktop uses the key returned by _renderRow (e.g. `divider X`)
    // mobile uses the `key` prop supplied on these row objects
    // use this to ensure we don't repeat a number for the arbitrary keys
    let keyState = 0
    const nextKey = () => {
      keyState++
      return keyState.toString()
    }

    const props = this.props
    const participants: Array<ParticipantRow> = props.participants.map(p => ({
      fullname: p.fullname,
      isAdmin: p.isAdmin,
      isOwner: p.isOwner,
      key: p.username,
      onShowProfile: props.onShowProfile,
      type: 'participant',
      username: p.username,
    }))

    const participantCount = participants.length

    let rows: Array<Row>
    const {teamname, channelname} = props
    if (teamname && channelname) {
      let headerRows: Array<TeamHeaderRow>
      const subHeaderRows = [
        {
          isSmallTeam: props.smallTeam,
          key: 'small team header',
          participantCount,
          teamname,
          type: 'small team header',
        },
      ]
      let addPeopleRow = false
      if (props.teamname && !props.isPreview && (props.admin || channelname !== 'general')) {
        // admins can add people to the team and to channels
        // anyone else can only add people to channels
        subHeaderRows.push(
          {
            key: nextKey(),
            marginBottom: 8,
            marginTop: 8,
            type: 'divider',
          },
          {
            isAdmin: props.admin,
            isGeneralChannel: channelname === 'general',
            key: 'add people',
            teamname: props.teamname,
            type: 'add people',
          }
        )
        addPeopleRow = true
      }
      if (props.smallTeam) {
        // Small team.
        headerRows = [
          {height: globalMargins.small, key: nextKey(), type: 'spacer'},
          ...subHeaderRows,
          {
            key: nextKey(),
            marginBottom: 20,
            marginTop: addPeopleRow ? 8 : 20,
            type: 'divider',
          },
          {
            key: 'notifications',
            type: 'notifications',
          },
          {
            key: nextKey(),
            marginBottom: 8,
            marginTop: 8,
            type: 'divider',
          },
          {
            canSetRetention: props.canSetRetention,
            entityType: 'small team',
            key: 'retention',
            teamname: props.teamname || '',
            type: 'retention',
          },
          {
            key: nextKey(),
            marginBottom: 8,
            marginTop: 8,
            type: 'divider',
          },
          {
            canSetMinWriterRole: props.canSetMinWriterRole,
            isSmallTeam: true,
            key: 'min writer role',
            type: 'min writer role',
          },
          ...(props.canDeleteHistory
            ? [
                {
                  key: nextKey(),
                  marginBottom: globalMargins.small,
                  marginTop: 8,
                  type: 'divider',
                },
                {
                  key: 'clear entire conversation',
                  onShowClearConversationDialog: props.onShowClearConversationDialog,
                  type: 'clear entire conversation',
                },
              ]
            : []),
          {
            key: nextKey(),
            marginTop: 8,
            type: 'divider',
          },
          props.ignored
            ? {
                key: 'unhide this conversation',
                onUnhideConv: props.onUnhideConv,
                type: 'unhide this conversation',
              }
            : {
                key: 'hide this conversation',
                onHideConv: props.onHideConv,
                type: 'hide this conversation',
              },
          {
            key: nextKey(),
            marginTop: 8,
            type: 'divider',
          },
          {
            key: 'participant count',
            label: 'In this team',
            participantCount,
            type: 'participant count',
          },
        ]
      } else {
        // Big team.
        const headerRow = {
          canEditChannel: props.canEditChannel,
          channelname,
          description: props.description,
          key: 'big team header',
          onEditChannel: props.onEditChannel,
          teamname,
          type: 'big team header',
        }
        const participantCountRow = {
          key: 'participant count',
          label: 'In this channel',
          participantCount,
          type: 'participant count',
        }

        if (props.isPreview) {
          // Big team, preview.
          headerRows = [
            headerRow,
            {
              height: globalMargins.tiny,
              key: nextKey(),
              type: 'spacer',
            },
            {
              key: 'join channel',
              onJoinChannel: props.onJoinChannel,
              teamname,
              type: 'join channel',
            },
            {
              key: nextKey(),
              marginBottom: globalMargins.tiny,
              type: 'divider',
            },
            ...subHeaderRows,
            {
              key: nextKey(),
              marginTop: globalMargins.tiny,
              type: 'divider',
            },
            participantCountRow,
          ]
        } else {
          // Big team, no preview.
          headerRows = [
            headerRow,
            {
              height: globalMargins.tiny,
              key: nextKey(),
              type: 'spacer',
            },
            ...(props.channelname !== 'general'
              ? [
                  {
                    key: 'leave channel',
                    onLeaveConversation: props.onLeaveConversation,
                    type: 'leave channel',
                  },
                ]
              : []),
            {
              key: nextKey(),
              marginBottom: globalMargins.tiny,
              type: 'divider',
            },
            ...subHeaderRows,
            {
              key: nextKey(),
              marginTop: globalMargins.tiny,
              type: 'divider',
            },
            {
              key: 'notifications',
              type: 'notifications',
            },
            {
              key: nextKey(),
              marginBottom: 8,
              marginTop: 8,
              type: 'divider',
            },
            {
              canSetRetention: props.canSetRetention,
              entityType: 'channel',
              key: 'retention',
              teamname: props.teamname || '',
              type: 'retention',
            },
            {
              key: nextKey(),
              marginBottom: 8,
              marginTop: 8,
              type: 'divider',
            },
            {
              canSetMinWriterRole: props.canSetMinWriterRole,
              isSmallTeam: false,
              key: 'min writer role',
              type: 'min writer role',
            },
            ...(props.canDeleteHistory
              ? [
                  {
                    key: nextKey(),
                    marginBottom: globalMargins.small,
                    marginTop: 8,
                    type: 'divider',
                  },
                  {
                    key: 'clear entire conversation',
                    onShowClearConversationDialog: props.onShowClearConversationDialog,
                    type: 'clear entire conversation',
                  },
                ]
              : []),
            {
              key: nextKey(),
              marginTop: 8,
              type: 'divider',
            },
            participantCountRow,
          ]
        }
      }
      rows = headerRows.concat(participants)
    } else {
      // Conversation.
      rows = participants.concat([
        {
          key: nextKey(),
          marginBottom: 10,
          marginTop: 10,
          type: 'divider',
        },
        {
          key: 'turn into team',
          onShowNewTeamDialog: props.onShowNewTeamDialog,
          type: 'turn into team',
        },
        {
          key: nextKey(),
          marginTop: 10,
          type: 'divider',
        },
        {
          key: 'notifications',
          type: 'notifications',
        },
        {
          key: nextKey(),
          marginBottom: 8,
          marginTop: 8,
          type: 'divider',
        },
        {
          canSetRetention: true,
          entityType: 'adhoc',
          key: 'retention',
          type: 'retention',
        },
        {
          key: nextKey(),
          marginBottom: globalMargins.small,
          marginTop: 8,
          type: 'divider',
        },
        {
          key: 'clear entire conversation',
          onShowClearConversationDialog: props.onShowClearConversationDialog,
          type: 'clear entire conversation',
        },
        {
          key: nextKey(),
          marginBottom: globalMargins.small,
          marginTop: 8,
          type: 'divider',
        },
        {
          key: 'block this conversation',
          onShowBlockConversationDialog: props.onShowBlockConversationDialog,
          type: 'block this conversation',
        },
        {
          key: nextKey(),
          marginTop: 8,
          type: 'divider',
        },
        props.ignored
          ? {
              key: 'unhide this conversation',
              onUnhideConv: props.onUnhideConv,
              type: 'unhide this conversation',
            }
          : {
              key: 'hide this conversation',
              onHideConv: props.onHideConv,
              type: 'hide this conversation',
            },
        {
          height: globalMargins.small,
          key: nextKey(),
          type: 'spacer',
        },
      ])
    }

    const rowSizeEstimator = index => typeSizeEstimator(rows[index])
    return (
      <List
        items={rows}
        renderItem={this._renderRow}
        keyProperty="key"
        style={listStyle}
        itemSizeEstimator={rowSizeEstimator}
      />
    )
  }
}

const InfoPanel = HeaderOnMobile(_InfoPanel)

export type {InfoPanelProps}
export {InfoPanel}
