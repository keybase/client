import * as React from 'react'
import * as C from '@/constants'
import {isBigTeam} from '@/constants/chat/helpers'
import * as Chat from '@/stores/chat'
import * as Teams from '@/stores/teams'
import {useCurrentUserState} from '@/stores/current-user'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {FloatingRolePicker, sendNotificationFooter} from '@/teams/role-picker'
import {getRolePickerDisabledReasons} from '@/teams/role-picker-utils'
import {formatTimeRelativeToNow} from '@/util/timestamp'
import MenuHeader from '../menu-header.new'
import {navToProfile} from '@/constants/router'
import {useLoadedTeam} from '../../use-loaded-team'

const positionFallbacks = ['left center', 'top left'] as const

export type RowProps = {
  ctime: number
  disabledReasonsForRolePicker: T.Teams.DisabledReasonsForRolePicker
  error?: string
  firstItem: boolean
  fullName: string
  onChat: () => void
  onIgnoreRequest: () => void
  onOpenProfile: (u: string) => void
  teamID: T.Teams.TeamID
  username: string
  reset?: boolean
  waiting: boolean
}

type RolePickerProps = {
  onAccept: () => void
  isRolePickerOpen: boolean
  onCancelRolePicker: () => void
  onConfirmRolePicker: (role: T.Teams.TeamRoleType) => void
  onEditMembership: () => void
  footerComponent: React.ReactNode
}

export type Props = {} & RowProps & RolePickerProps

export const TeamRequestRow = (props: Props) => {
  const {ctime, fullName, username, onAccept, onOpenProfile, reset} = props

  const approveWord = reset ? 'Readmit' : 'Approve'
  const denyWord = reset ? 'Remove' : 'Deny'

  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    return (
      <Kb.FloatingMenu
        header={
          <MenuHeader
            username={username}
            fullName={fullName ? fullName : undefined}
            label={
              reset ? 'Reset their account' : `Requested to join ${formatTimeRelativeToNow(ctime * 1000)}`
            }
          />
        }
        items={[
          'Divider',
          {icon: 'iconfont-chat', onClick: props.onChat, title: 'Chat'},
          {icon: 'iconfont-check', onClick: props.onAccept, title: approveWord},
          {
            danger: true,
            icon: 'iconfont-block',
            onClick: props.onIgnoreRequest,
            subTitle: `They won't be notified`,
            title: denyWord,
          },
        ]}
        visible={true}
        onHidden={hidePopup}
        closeOnSelect={true}
        attachTo={attachTo}
        position="bottom left"
        positionFallbacks={positionFallbacks}
      />
    )
  }
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  return (
    <Kb.ListItem
      type="Small"
      icon={<Kb.Avatar username={username} size={32} />}
      body={
        <Kb.Box2 direction="horizontal" fullHeight={true} alignItems="center">
          <Kb.Box2 direction="vertical" fullWidth={true}>
            <Kb.ConnectedUsernames type="BodyBold" colorFollowing={true} usernames={username} />
            <Kb.Box2 direction="horizontal" alignSelf="flex-start">
              <Kb.Meta
                title={reset ? 'locked out' : 'please decide'}
                style={styleCharm}
                backgroundColor={reset ? Kb.Styles.globalColors.red : Kb.Styles.globalColors.orange}
              />
              {Kb.Styles.isMobile ? (
                C.isLargeScreen && (
                  <Kb.Text type="BodySmall" ellipsizeMode="tail" lineClamp={1} style={styles.newFullName}>
                    {fullName !== '' && `${fullName}`}
                  </Kb.Text>
                )
              ) : (
                <Kb.Text type="BodySmall" lineClamp={1}>
                  {fullName !== '' && `${fullName}  • `}
                  {reset
                    ? fullName
                      ? 'Reset their account'
                      : 'reset their account'
                    : formatTimeRelativeToNow(ctime * 1000)}
                </Kb.Text>
              )}
            </Kb.Box2>
            {!!props.error && <Kb.Text type="BodySmallError">{props.error}</Kb.Text>}
          </Kb.Box2>
        </Kb.Box2>
      }
      action={
        <Kb.Box2 direction="horizontal">
          <FloatingRolePicker
            footerComponent={props.footerComponent}
            onConfirm={props.onConfirmRolePicker}
            onCancel={props.onCancelRolePicker}
            position="bottom left"
            open={props.isRolePickerOpen}
            disabledRoles={props.disabledReasonsForRolePicker}
          >
            <Kb.Button
              label={approveWord}
              onClick={onAccept}
              small={true}
              style={styles.letInButton}
              waiting={props.waiting}
            />
          </FloatingRolePicker>
          <Kb.IconButton
            mode="Secondary"
            type="Dim"
            small={true}
            icon="iconfont-ellipsis"
            style={styles.ignoreButton}
            onClick={showPopup}
            ref={popupAnchor}
          />
          {popup}
        </Kb.Box2>
      }
      onClick={props.isRolePickerOpen ? undefined : () => onOpenProfile(username)}
      firstItem={props.firstItem}
      style={props.waiting ? styles.disabled : styles.bg}
    />
  )
}

const styleCharm = {
  alignSelf: 'center',
  marginRight: Kb.Styles.globalMargins.xtiny,
} as const

const styles = Kb.Styles.styleSheetCreate(() => ({
  bg: {backgroundColor: Kb.Styles.globalColors.white},
  disabled: {backgroundColor: Kb.Styles.globalColors.white, opacity: 0.4},
  ignoreButton: {marginLeft: Kb.Styles.globalMargins.xtiny},
  letInButton: {
    backgroundColor: Kb.Styles.globalColors.green,
    marginLeft: Kb.Styles.globalMargins.xtiny,
  },
  newFullName: {
    ...Kb.Styles.globalStyles.flexOne,
    paddingRight: Kb.Styles.globalMargins.xtiny,
  },
}))

type OwnProps = {
  ctime: number
  firstItem: boolean
  fullName: string
  username: string
  reset?: boolean
  teamID: T.Teams.TeamID
}

type ExtraProps = {
  _notifLabel: string
  letIn: (sendNotification: boolean, role: T.Teams.TeamRoleType, onError: (message: string) => void) => void
}

const RequestRowStateWrapper = (props: RowProps & ExtraProps) => {
  const [rolePickerOpen, setRolePickerOpen] = React.useState(false)
  const [sendNotification, setSendNotification] = React.useState(true)
  const [error, setError] = React.useState('')

  const {_notifLabel, letIn, ...rest} = props

  return (
    <TeamRequestRow
      {...rest}
      error={error}
      onAccept={() => setRolePickerOpen(true)}
      isRolePickerOpen={rolePickerOpen}
      onCancelRolePicker={() => setRolePickerOpen(false)}
      onEditMembership={() => setRolePickerOpen(true)}
      footerComponent={
        props.reset
          ? undefined
          : sendNotificationFooter(_notifLabel, sendNotification, nextVal => setSendNotification(nextVal))
      }
      onConfirmRolePicker={role => {
        setRolePickerOpen(false)
        setError('')
        letIn(!props.reset && sendNotification, role, setError)
      }}
    />
  )
}

const Container = (ownProps: OwnProps) => {
  const {teamID, username, reset, fullName} = ownProps
  const currentUsername = useCurrentUserState(s => s.username)
  const {
    teamDetails,
    teamMeta: {teamname},
    yourOperations,
  } = useLoadedTeam(teamID)
  const _notifLabel = Chat.useChatState(s =>
    isBigTeam(s.inboxLayout, teamID) ? `Announce them in #general` : `Announce them in team chat`
  )
  const disabledReasonsForRolePicker = getRolePickerDisabledReasons({
    canManageMembers: yourOperations.manageMembers,
    currentUsername,
    members: teamDetails.members,
    membersToModify: username,
    teamname,
  })
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyTeamsAddMember(teamID, username))
  const removeMember = Teams.useTeamsState(s => s.dispatch.removeMember)
  const ignoreRequest = Teams.useTeamsState(s => s.dispatch.ignoreRequest)

  const _onIgnoreRequest = (teamname: string) => {
    if (reset) {
      removeMember(teamID, username)
    } else {
      ignoreRequest(teamID, teamname, username)
    }
  }

  const addToTeam = C.useRPC(T.RPCGen.teamsTeamAddMembersMultiRoleRpcPromise)
  const navigateAppend = C.Router2.navigateAppend
  const letIn = (
    sendNotification: boolean,
    role: T.Teams.TeamRoleType,
    onError: (message: string) => void
  ) => {
    addToTeam(
      [
        {
          sendChatNotification: sendNotification,
          teamID,
          users: [{assertion: username, role: T.RPCGen.TeamRole[role]}],
        },
        [C.waitingKeyTeamsTeam(teamID), C.waitingKeyTeamsAddMember(teamID, username)],
      ],
      res => {
        const usernames = res.notAdded?.map(user => user.username) ?? []
        if (usernames.length) {
          navigateAppend({name: 'contactRestricted', params: {source: 'teamAddSomeFailed', usernames}})
        }
      },
      err => {
        if (err.code === T.RPCGen.StatusCode.scteamcontactsettingsblock) {
          const users = (err.fields as Array<{key?: string; value?: string} | undefined> | undefined)
            ?.filter(field => field?.key === 'usernames')
            .map(field => field?.value)
          const usernames = users?.[0]?.split(',') ?? []
          navigateAppend({name: 'contactRestricted', params: {source: 'teamAddAllFailed', usernames}})
          return
        }
        onError(err.message)
      }
    )
  }
  const previewConversation = C.Router2.previewConversation
  const onChat = () => {
    username && previewConversation({participants: [username], reason: 'teamInvite'})
  }
  const onOpenProfile = () => {
    navToProfile(username)
  }
  const props = {
    _notifLabel: _notifLabel,
    ctime: ownProps.ctime,
    disabledReasonsForRolePicker: disabledReasonsForRolePicker,
    firstItem: ownProps.firstItem,
    fullName: fullName,
    letIn: letIn,
    onChat: onChat,
    onIgnoreRequest: () => _onIgnoreRequest(teamname),
    onOpenProfile: onOpenProfile,
    reset: ownProps.reset,
    teamID: ownProps.teamID,
    username: ownProps.username,
    waiting: waiting,
  }
  return <RequestRowStateWrapper {...props} />
}

export default Container
