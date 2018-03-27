// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import {Box, Divider, HeaderHoc, List} from '../../../common-adapters'
import {type Props as HeaderHocProps} from '../../../common-adapters/header-hoc'
import {globalColors, globalMargins, globalStyles, isMobile, platformStyles} from '../../../styles'
import {SmallTeamHeader, BigTeamHeader} from './header'
import Notifications from './notifications/container'
import Participant, {AddPeople} from './participant'
import {ParticipantCount} from './participant-count'
import {CaptionedButton, CaptionedDangerIcon} from './channel-utils'
import RetentionPicker from '../../../teams/team/settings/retention/container'

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

const Spacer = ({height}: {height: number}) => <Box style={{width: 1, height}} />

type InfoPanelProps = {
  selectedConversationIDKey: Types.ConversationIDKey,
  participants: Array<{
    username: string,
    fullname: string,
  }>,
  isPreview: boolean,
  teamname: ?string,
  channelname: ?string,
  smallTeam: boolean,
  admin: boolean,

  // Used by HeaderHoc.
  onBack: () => void,

  // Used by Participant.
  onShowProfile: (username: string) => void,

  // Used for conversations.
  onShowBlockConversationDialog: () => void,
  onShowNewTeamDialog: () => void,

  // Used for small and big teams.
  onAddPeople: (?Element) => void,
  onViewTeam: () => void,
  onClickGear: (?Element) => void,
  canSetRetention: boolean,

  // Used for big teams.
  canEditChannel: boolean,
  description: ?string,
  onEditChannel: () => void,
  onLeaveConversation: () => void,
  onJoinChannel: () => void,
} & HeaderHocProps

// FYI: Don't add a property of type ConversationIDKey to one of these rows or flow will explode
// use this.props in _renderRow instead

type AddPeopleRow = {
  type: 'add people',
  key: 'add people',
  onClick: (?Element) => void,
}

type ParticipantRow = {
  type: 'participant',
  key: string,
  username: string,
  fullname: string,
  onShowProfile: string => void,
}

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
  teamname: string,
  isTeamWide: boolean,
  isSmallTeam: boolean,
}

const retentionStyles = {
  containerStyle: platformStyles({
    common: {
      marginLeft: 16,
      marginRight: 45,
    },
    isMobile: {
      marginRight: 16,
    },
  }),
  dropdownStyle: platformStyles({
    common: {
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

type ParticipantCountRow = {
  type: 'participant count',
  key: 'participant count',
  label: string,
  participantCount: number,
}

type SmallTeamHeaderRow = {
  type: 'small team header',
  key: 'small team header',
  teamname: string,
  participantCount: number,
  onViewTeam: () => void,
  onClickGear: (?Element) => void,
}

type BigTeamHeaderRow = {
  type: 'big team header',
  key: 'big team header',
  canEditChannel: boolean,
  onEditChannel: () => void,
  description: ?string,
  teamname: string,
  channelname: string,
  onViewTeam: () => void,
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

// All the row types that can appear in a small or big team header.
type TeamHeaderRow =
  | DividerRow
  | SpacerRow
  | NotificationsRow
  | ParticipantCountRow
  | RetentionRow
  | SmallTeamHeaderRow
  | BigTeamHeaderRow
  | JoinChannelRow
  | LeaveChannelRow

type Row =
  | AddPeopleRow
  | ParticipantRow
  | SpacerRow
  | DividerRow
  | NotificationsRow
  | TurnIntoTeamRow
  | BlockThisConversationRow
  | TeamHeaderRow

const typeSizeEstimator = (row: Row): number => {
  // The sizes below are retrieved by using the React DevTools
  // inspector on the appropriate components, including margins.
  switch (row.type) {
    case 'add people':
      return 48

    case 'participant':
      return 56

    case 'divider':
      const style = getDividerStyle(row)
      return 1 + style.marginTop + style.marginBottom

    case 'spacer':
      return row.height

    case 'notifications':
      return 270

    case 'turn into team':
      return 47

    case 'block this conversation':
      return 17

    case 'participant count':
      return 15

    case 'small team header':
      return 32

    case 'big team header':
      // This depends on how long the description is
      // ballpark estimate between an empty and 1-line description
      return 57

    case 'join channel':
      return 47

    case 'leave channel':
      return 17

    case 'retention':
      return 75

    default:
      // eslint-disable-next-line no-unused-expressions
      ;(row.type: empty)
      throw new Error(`Impossible case encountered: ${row.type}`)
  }
}

class _InfoPanel extends React.Component<InfoPanelProps> {
  _renderRow = (i: number, row: Row): React.Node => {
    switch (row.type) {
      case 'add people':
        return <AddPeople key="add people" onClick={row.onClick} />
      case 'participant':
        return <Participant key={`participant ${row.key}`} {...row} />

      case 'divider':
        return <Divider key={`divider ${row.key}`} style={getDividerStyle(row)} />

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
            participantCount={row.participantCount}
            onClick={row.onViewTeam}
            onClickGear={row.onClickGear}
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
            onClick={row.onViewTeam}
          />
        )

      case 'join channel':
        return (
          <CaptionedButton
            caption={`Anyone in ${row.teamname} can join.`}
            key="join channel"
            label="Join channel"
            onClick={row.onJoinChannel}
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
            dropdownStyle={retentionStyles.dropdownStyle}
            conversationIDKey={this.props.selectedConversationIDKey}
            teamname={row.teamname}
            type="auto"
            isTeamWide={row.isTeamWide}
            isSmallTeam={row.isSmallTeam}
          />
        )

      default:
        // eslint-disable-next-line no-unused-expressions
        ;(row.type: empty)
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
      type: 'participant',
      key: p.username,
      username: p.username,
      fullname: p.fullname,
      onShowProfile: props.onShowProfile,
    }))

    const participantCount = participants.length

    let rows: Array<Row>
    const {teamname, channelname, onViewTeam, onClickGear} = props
    if (teamname && channelname) {
      let headerRows: Array<TeamHeaderRow>
      const smallTeamHeaderRow = {
        type: 'small team header',
        key: 'small team header',
        teamname,
        participantCount,
        onViewTeam,
        onClickGear,
      }
      if (props.smallTeam) {
        // Small team.
        const retentionRows = props.canSetRetention
          ? [
              {
                type: 'divider',
                key: nextKey(),
                marginBottom: 0,
              },
              {
                type: 'retention',
                key: 'retention',
                conversationIDKey: props.selectedConversationIDKey,
                teamname: props.teamname || '',
                isTeamWide: props.smallTeam,
                isSmallTeam: props.smallTeam,
              },
            ]
          : []

        headerRows = [
          {type: 'spacer', key: nextKey(), height: globalMargins.small},
          smallTeamHeaderRow,
          {
            type: 'divider',
            key: nextKey(),
            marginBottom: 20,
            marginTop: 20,
          },
          {
            type: 'notifications',
            key: 'notifications',
          },
          ...retentionRows,
          {
            type: 'divider',
            key: nextKey(),
          },
          {
            type: 'participant count',
            key: 'participant count',
            label: 'In this team',
            participantCount,
          },
        ]
      } else {
        // Big team.
        const headerRow = {
          type: 'big team header',
          key: 'big team header',
          canEditChannel: props.canEditChannel,
          onEditChannel: props.onEditChannel,
          description: props.description,
          teamname,
          channelname,
          onViewTeam,
        }
        const participantCountRow = {
          type: 'participant count',
          key: 'participant count',
          label: 'In this channel',
          participantCount,
        }

        if (props.isPreview) {
          // Big team, preview.
          headerRows = [
            headerRow,
            {
              type: 'spacer',
              key: nextKey(),
              height: globalMargins.tiny,
            },
            {
              type: 'join channel',
              key: 'join channel',
              teamname,
              onJoinChannel: props.onJoinChannel,
            },
            {
              type: 'divider',
              key: nextKey(),
              marginBottom: globalMargins.tiny,
            },
            smallTeamHeaderRow,
            {
              type: 'divider',
              key: nextKey(),
              marginTop: globalMargins.tiny,
            },
            participantCountRow,
          ]
        } else {
          // Big team, no preview.
          const retentionRows = props.canSetRetention
            ? [
                {
                  type: 'divider',
                  key: nextKey(),
                  marginBottom: 0,
                },
                {
                  type: 'retention',
                  key: 'retention',
                  conversationIDKey: props.selectedConversationIDKey,
                  teamname: props.teamname || '',
                  isTeamWide: props.smallTeam,
                  isSmallTeam: props.smallTeam,
                },
              ]
            : []

          headerRows = [
            headerRow,
            {
              type: 'spacer',
              key: nextKey(),
              height: globalMargins.tiny,
            },
            ...(props.channelname !== 'general'
              ? [
                  {
                    type: 'leave channel',
                    key: 'leave channel',
                    onLeaveConversation: props.onLeaveConversation,
                  },
                ]
              : []),
            {
              type: 'divider',
              key: nextKey(),
              marginBottom: globalMargins.tiny,
            },
            smallTeamHeaderRow,
            {
              type: 'divider',
              key: nextKey(),
              marginTop: globalMargins.tiny,
            },
            {
              type: 'notifications',
              key: 'notifications',
            },
            ...retentionRows,
            {
              type: 'divider',
              key: nextKey(),
            },
            participantCountRow,
          ]
        }
      }
      rows = headerRows.concat(participants)
      if (props.admin && props.teamname && !props.isPreview) {
        rows = rows.concat({type: 'add people', key: 'add people', onClick: props.onAddPeople})
      }
    } else {
      // Conversation.
      rows = participants.concat([
        {
          type: 'divider',
          key: nextKey(),
          marginBottom: 10,
          marginTop: 10,
        },
        {
          type: 'turn into team',
          key: 'turn into team',
          onShowNewTeamDialog: props.onShowNewTeamDialog,
        },
        {
          type: 'divider',
          key: nextKey(),
          marginTop: 10,
        },
        {
          type: 'notifications',
          key: 'notifications',
        },
        {
          type: 'divider',
          key: nextKey(),
          marginBottom: globalMargins.small,
        },
        {
          type: 'block this conversation',
          key: 'block this conversation',
          onShowBlockConversationDialog: props.onShowBlockConversationDialog,
        },
        {
          type: 'spacer',
          key: nextKey(),
          height: globalMargins.small,
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

const InfoPanel = isMobile ? HeaderHoc(_InfoPanel) : _InfoPanel

export type {InfoPanelProps}
export {InfoPanel}
