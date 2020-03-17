import * as React from 'react'
import * as Types from '../../../../../constants/types/teams'
import * as Kb from '../../../../../common-adapters'
import * as Container from '../../../../../util/container'
import {FloatingRolePicker} from '../../../../role-picker'
import * as Styles from '../../../../../styles'
import flags from '../../../../../util/feature-flags'
import {isLargeScreen} from '../../../../../constants/platform'
import {formatTimeRelativeToNow} from '../../../../../util/timestamp'
import MenuHeader from '../../menu-header.new'

export type RowProps = {
  ctime: number
  disabledReasonsForRolePicker: Types.DisabledReasonsForRolePicker
  fullName: string
  onChat: () => void
  onIgnoreRequest: () => void
  onOpenProfile: (u: string) => void
  teamID: Types.TeamID
  username: string
}

type RolePickerProps = {
  onAccept: () => void
  isRolePickerOpen: boolean
  onCancelRolePicker: () => void
  onConfirmRolePicker: (role: Types.TeamRoleType) => void
  onEditMembership: () => void
  onSelectRole: (role: Types.TeamRoleType) => void
  footerComponent: React.ReactNode
  selectedRole: Types.TeamRoleType | null
}

export type Props = {} & RowProps & RolePickerProps

const TeamRequestRowOld = (props: Props) => {
  const {username, onOpenProfile, onChat, onIgnoreRequest, onAccept} = props
  return (
    <Kb.Box style={styles.container}>
      <Kb.ClickableBox style={styles.clickContainer} onClick={() => onOpenProfile(username)}>
        <Kb.Avatar username={username} size={Styles.isMobile ? 48 : 32} />
        <Kb.Box style={styles.userDetails}>
          <Kb.ConnectedUsernames type="BodyBold" colorFollowing={true} usernames={username} />
          <Kb.Box style={Styles.globalStyles.flexBoxRow}>
            <Kb.Meta title="please decide" style={styleCharm} backgroundColor={Styles.globalColors.orange} />
          </Kb.Box>
        </Kb.Box>
      </Kb.ClickableBox>
      <Kb.Box style={styles.floatingRolePickerContainer}>
        <FloatingRolePicker
          selectedRole={props.selectedRole}
          onSelectRole={props.onSelectRole}
          floatingContainerStyle={styles.floatingRolePicker}
          footerComponent={props.footerComponent}
          onConfirm={props.onConfirmRolePicker}
          onCancel={props.onCancelRolePicker}
          position="bottom left"
          open={props.isRolePickerOpen}
          disabledRoles={props.disabledReasonsForRolePicker}
        >
          <Kb.Button label="Let in as..." onClick={onAccept} small={true} style={styles.letInButton} />
        </FloatingRolePicker>
        <Kb.Button
          label="Ignore"
          onClick={onIgnoreRequest}
          small={true}
          style={styles.ignoreButton}
          type="Danger"
        />
        {!Styles.isMobile && <Kb.Icon onClick={onChat} style={styles.icon} type="iconfont-chat" />}
      </Kb.Box>
    </Kb.Box>
  )
}

const TeamRequestRowNew = (props: Props) => {
  const {ctime, fullName, username, onAccept, onOpenProfile, teamID} = props

  const isNew = Container.useSelector(s => s.teams.newTeamRequests.get(teamID)?.has(username) ?? false)

  const {showingPopup, setShowingPopup, toggleShowingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <Kb.FloatingMenu
      header={{
        title: 'header',
        view: (
          <MenuHeader
            username={username}
            fullName={fullName ? fullName : undefined}
            label={`Requested to join ${formatTimeRelativeToNow(ctime * 1000)}`}
          />
        ),
      }}
      items={[
        'Divider',
        {icon: 'iconfont-chat', onClick: props.onChat, title: 'Chat'},
        {icon: 'iconfont-check', onClick: props.onAccept, title: 'Approve'},
        {
          danger: true,
          icon: 'iconfont-block',
          onClick: props.onIgnoreRequest,
          subTitle: `They won't be notified`,
          title: 'Deny',
        },
      ]}
      visible={showingPopup}
      onHidden={() => setShowingPopup(false)}
      closeOnSelect={true}
      attachTo={attachTo}
      position="bottom left"
      positionFallbacks={['top left']}
    />
  ))

  return (
    <Kb.ListItem2
      type="Small"
      icon={<Kb.Avatar username={username} size={32} />}
      body={
        <Kb.Box2 direction="horizontal" fullHeight={true} alignItems="center">
          <Kb.Box2 direction="vertical" fullWidth={true}>
            <Kb.ConnectedUsernames type="BodyBold" colorFollowing={true} usernames={username} />
            <Kb.Box2 direction="horizontal">
              {isNew && (
                <Kb.Meta
                  title="please decide"
                  style={styleCharm}
                  backgroundColor={Styles.globalColors.orange}
                />
              )}
              {Styles.isMobile ? (
                isLargeScreen && (
                  <Kb.Text type="BodySmall" ellipsizeMode="tail" lineClamp={1} style={styles.newFullName}>
                    {fullName !== '' && `${fullName}`}
                  </Kb.Text>
                )
              ) : (
                <Kb.Text type="BodySmall" lineClamp={1}>
                  {fullName !== '' && `${fullName}  • `}
                  {formatTimeRelativeToNow(ctime * 1000)}
                </Kb.Text>
              )}
            </Kb.Box2>
          </Kb.Box2>
        </Kb.Box2>
      }
      action={
        <Kb.Box2 direction="horizontal">
          <FloatingRolePicker
            selectedRole={props.selectedRole}
            onSelectRole={props.onSelectRole}
            floatingContainerStyle={styles.floatingRolePicker}
            footerComponent={props.footerComponent}
            onConfirm={props.onConfirmRolePicker}
            onCancel={props.onCancelRolePicker}
            position="bottom left"
            open={props.isRolePickerOpen}
            disabledRoles={props.disabledReasonsForRolePicker}
          >
            <Kb.Button label="Approve" onClick={onAccept} small={true} style={styles.letInButton} />
          </FloatingRolePicker>
          <Kb.Button
            mode="Secondary"
            type="Dim"
            small={true}
            icon="iconfont-ellipsis"
            style={styles.ignoreButton}
            onClick={toggleShowingPopup}
            ref={popupAnchor}
          />
          {popup}
        </Kb.Box2>
      }
      onClick={() => onOpenProfile(username)}
      firstItem={true /* TODO */}
    />
  )
}

export const TeamRequestRow = flags.teamsRedesign ? TeamRequestRowNew : TeamRequestRowOld

const styleCharm = {
  alignSelf: 'center',
  marginRight: Styles.globalMargins.xtiny,
} as const

const styles = Styles.styleSheetCreate(() => ({
  clickContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      flexGrow: 1,
      flexShrink: 0,
    },
    isElectron: {
      width: 'initial',
    },
  }),
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
      alignItems: 'center',
      flexDirection: 'row',
      flexShrink: 0,
      height: 48,
      width: '100%',
    },
    isMobile: {
      flexDirection: 'column',
      height: 112,
    },
  }),
  floatingRolePicker: Styles.platformStyles({
    isElectron: {
      position: 'relative',
      top: -32,
    },
  }),
  floatingRolePickerContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      marginTop: 0,
    },
    isMobile: {
      marginTop: Styles.globalMargins.tiny,
    },
  }),
  icon: {
    marginLeft: Styles.globalMargins.small,
    marginRight: Styles.globalMargins.tiny,
  },
  ignoreButton: {
    marginLeft: Styles.globalMargins.xtiny,
  },
  letInButton: {
    backgroundColor: Styles.globalColors.green,
    marginLeft: Styles.globalMargins.xtiny,
  },
  newFullName: {
    ...Styles.globalStyles.flexOne,
    paddingRight: Styles.globalMargins.xtiny,
  },
  userDetails: {
    ...Styles.globalStyles.flexBoxColumn,
    flexGrow: 1,
    marginLeft: Styles.globalMargins.small,
  },
}))
