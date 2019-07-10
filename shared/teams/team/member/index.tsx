import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {FloatingRolePicker, roleIconMap} from '../../role-picker'

type RolePickerSpecificProps = {
  isRolePickerOpen: boolean
  onCancelRolePicker: () => void
  onConfirmRolePicker: (role: Types.TeamRoleType) => void
  onEditMembership: () => void
  onSelectRole: (role: Types.TeamRoleType) => void
  selectedRole: Types.TeamRoleType | null
}

export type MemberProps = {
  admin: boolean
  disabledReasonsForRolePicker: Types.DisabledReasonsForRolePicker
  follower: boolean
  following: boolean
  loading: boolean
  user: {
    type: Types.TeamRoleType | null
    username: string
  }
  teamname: string
  you: {
    type: Types.TeamRoleType | null
    username: string
  }
  onOpenProfile: () => void
  onChat: () => void
  onRemoveMember: () => void
  onBack: () => void
}

export type Props = MemberProps & RolePickerSpecificProps

export const TeamMember = (props: Props) => {
  const {user, you} = props
  const iconType = user.type && roleIconMap[user.type]
  return (
    <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, alignItems: 'center', flex: 1}}>
      <Kb.Box
        style={{
          ...Styles.globalStyles.flexBoxColumn,
          alignItems: 'center',
          marginBottom: Styles.globalMargins.large,
          marginTop: Styles.globalMargins.large,
        }}
      >
        <Kb.Box
          style={{
            ...Styles.globalStyles.flexBoxRow,
            alignItems: 'center',
            margin: Styles.globalMargins.small,
          }}
        >
          <Kb.Avatar
            onClick={props.onOpenProfile}
            style={{alignSelf: 'center', marginRight: Styles.globalMargins.tiny}}
            username={user.username}
            showFollowingStatus={true}
            size={64}
          />
          {iconType ? (
            <Kb.Icon
              type={iconType}
              style={{
                alignSelf: 'center',
                margin: Styles.globalMargins.tiny,
              }}
              fontSize={28}
            />
          ) : null}
          <Kb.Avatar
            style={{alignSelf: 'center', marginLeft: Styles.globalMargins.tiny}}
            isTeam={true}
            teamname={props.teamname}
            size={64}
          />
        </Kb.Box>
        <Kb.Box
          style={{
            ...Styles.globalStyles.flexBoxRow,
            alignItems: 'center',
            height: 20,
            margin: Styles.globalMargins.small,
          }}
        >
          {props.loading && <Kb.ProgressIndicator style={{alignSelf: 'center', height: 20, width: 20}} />}
        </Kb.Box>
        <Kb.Usernames
          type="HeaderBig"
          colorFollowing={!(you && you.username === user.username)} // De-colorize if this is own member page
          users={[{following: props.following, username: user.username}]}
          onUsernameClicked={props.onOpenProfile}
        />
        <Kb.Text type="BodySmall">
          {props.loading ? '... ' : user.type} in {props.teamname}
        </Kb.Text>
      </Kb.Box>
      <Kb.ButtonBar direction={Styles.isMobile ? 'column' : 'row'}>
        <Kb.Button label="Chat" onClick={props.onChat}>
          <Kb.Icon
            type="iconfont-chat"
            style={{
              marginRight: 8,
            }}
            color={Styles.globalColors.white}
          />
        </Kb.Button>
        {props.admin && (
          <FloatingRolePicker
            selectedRole={props.selectedRole}
            presetRole={props.user.type}
            onSelectRole={props.onSelectRole}
            floatingContainerStyle={styles.floatingRolePicker}
            onConfirm={props.onConfirmRolePicker}
            onCancel={props.onCancelRolePicker}
            position={'top center'}
            open={props.isRolePickerOpen}
            disabledRoles={props.disabledReasonsForRolePicker}
          >
            <Kb.Button type="Dim" label="Edit role" onClick={props.onEditMembership} />
          </FloatingRolePicker>
        )}
        {props.admin && (
          <Kb.Button
            type="Danger"
            label={you && you.username === user.username ? 'Leave team' : 'Remove'}
            onClick={props.onRemoveMember}
          />
        )}
      </Kb.ButtonBar>
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate({
  floatingRolePicker: Styles.platformStyles({
    isElectron: {
      bottom: -32,
      position: 'relative',
    },
  }),
})
