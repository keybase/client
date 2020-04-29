import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import {FloatingRolePicker, roleIconMap} from '../../role-picker'
import {useTeamDetailsSubscribe} from '../../subscriber'

type RolePickerSpecificProps = {
  isRolePickerOpen: boolean
  onCancelRolePicker: () => void
  onConfirmRolePicker: (role: Types.TeamRoleType) => void
  onEditMembership: () => void
}

export type MemberProps = {
  admin: boolean
  disabledReasonsForRolePicker: Types.DisabledReasonsForRolePicker
  error: string
  follower: boolean
  following: boolean
  loading: boolean
  user: {
    type: Types.TeamRoleType | null
    username: string
  }
  teamID: Types.TeamID
  teamname: string
  you: {
    type: Types.TeamRoleType | null
    username: string
  }
  onOpenProfile: () => void
  onChat: () => void
  onRemoveMember: () => void
  onBack: () => void
  onBlur: () => void
}

export type Props = MemberProps & RolePickerSpecificProps

const useCloseIfNoLongerInTeam = (type: Types.TeamRoleType | null) => {
  const prevType = Container.usePrevious(type)
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  React.useEffect(() => {
    if (type === null && prevType !== null) {
      dispatch(nav.safeNavigateUpPayload())
    }
  })
}

export const TeamMember = (props: Props) => {
  useTeamDetailsSubscribe(props.teamID)
  Container.useFocusBlur(undefined, props.onBlur)
  const {user, you, error} = props
  const iconType = user.type && roleIconMap[user.type]
  useCloseIfNoLongerInTeam(user.type)
  return (
    <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, alignItems: 'center', flex: 1}}>
      {!!error && <Kb.Banner color="red">{error}</Kb.Banner>}
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
        <Kb.ConnectedUsernames
          type="HeaderBig"
          colorFollowing={!(you && you.username === user.username)} // De-colorize if this is own member page
          usernames={user.username}
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
            color={Styles.globalColors.whiteOrWhite}
          />
        </Kb.Button>
        {props.admin && user.type !== 'bot' && user.type !== 'restrictedbot' && (
          <FloatingRolePicker
            presetRole={props.user.type}
            floatingContainerStyle={styles.floatingRolePicker}
            onConfirm={props.onConfirmRolePicker}
            onCancel={props.onCancelRolePicker}
            position="top center"
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

const styles = Styles.styleSheetCreate(() => ({
  floatingRolePicker: Styles.platformStyles({
    isElectron: {
      bottom: -32,
      position: 'relative',
    },
  }),
}))
