import * as React from 'react'
import * as Types from '../../../../../constants/types/teams'
import * as Kb from '../../../../../common-adapters'
import {FloatingRolePicker} from '../../../../role-picker'
import * as Styles from '../../../../../styles'
import flags from '../../../../../util/feature-flags'
import {isLargeScreen} from '../../../../../constants/platform'
import moment from 'moment'

export type RowProps = {
  ctime: number
  disabledReasonsForRolePicker: Types.DisabledReasonsForRolePicker
  fullName: string
  onChat: () => void
  onIgnoreRequest: () => void
  onOpenProfile: (u: string) => void
  teamname: string
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
          <Kb.ConnectedUsernames type="BodySemibold" colorFollowing={true} usernames={[username]} />
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
  const {ctime, fullName, username, onAccept, onOpenProfile} = props

  const {showingPopup, setShowingPopup, toggleShowingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <Kb.FloatingMenu
      items={[
        {onClick: props.onChat, title: 'Chat'},
        {danger: true, onClick: props.onIgnoreRequest, title: 'Deny'},
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
    <Kb.Box style={styles.newContainer}>
      <Kb.ClickableBox style={styles.clickContainer} onClick={() => onOpenProfile(username)}>
        <Kb.Avatar username={username} size={Styles.isMobile ? 48 : 32} />
        <Kb.Box style={styles.userDetails}>
          <Kb.ConnectedUsernames type="BodySemibold" colorFollowing={true} usernames={[username]} />
          <Kb.Box style={styles.newSubtext}>
            <Kb.Meta title="please decide" style={styleCharm} backgroundColor={Styles.globalColors.orange} />
            {Styles.isMobile ? (
              isLargeScreen && (
                <Kb.Text
                  type="BodySmall"
                  ellipsizeMode="tail"
                  lineClamp={1}
                  style={styles.newFullNameMobileText}
                >
                  {fullName !== '' && `${fullName}`}
                </Kb.Text>
              )
            ) : (
              <Kb.Text type="BodySmall" lineClamp={1}>
                {fullName !== '' && `${fullName}  • `}
                {moment(ctime * 1000).fromNow()}
              </Kb.Text>
            )}
          </Kb.Box>
        </Kb.Box>
      </Kb.ClickableBox>
      <Kb.Box style={styles.newButtonBarContainer}>
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
          tooltip=""
          style={styles.ignoreButton}
          onClick={toggleShowingPopup}
          ref={popupAnchor}
        />
        {popup}
      </Kb.Box>
    </Kb.Box>
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
  newButtonBarContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      flexGrow: 0,
      flexShrink: 1,
      marginTop: 0,
    },
  }),
  newContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
      alignItems: 'center',
      backgroundColor: '#ff0000',
      display: 'flex',
      flexDirection: 'row',
      flexShrink: 0,
      height: 48,
      width: '100%',
    },
    isMobile: {
      height: 56,
    },
  }),
  newFullNameMobileText: {
    flexGrow: 1,
    flexShrink: 0,
  },
  newSubtext: {
    ...Styles.globalStyles.flexBoxRow,
  },
  userDetails: {
    ...Styles.globalStyles.flexBoxColumn,
    flexGrow: 1,
    marginLeft: Styles.globalMargins.small,
  },
}))
