import * as React from 'react'
import * as Types from '../../../../../constants/types/teams'
import {
  Avatar,
  Box,
  Button,
  ClickableBox,
  Icon,
  Meta,
  ConnectedUsernames,
} from '../../../../../common-adapters'
import {FloatingRolePicker} from '../../../../role-picker'
import * as Styles from '../../../../../styles'

export type RowProps = {
  disabledReasonsForRolePicker: Types.DisabledReasonsForRolePicker
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

export const TeamRequestRow = (props: Props) => {
  const {username, onOpenProfile, onChat, onIgnoreRequest, onAccept} = props
  return (
    <Box style={styles.container}>
      <ClickableBox style={styles.clickContainer} onClick={() => onOpenProfile(username)}>
        <Avatar username={username} size={Styles.isMobile ? 48 : 32} />
        <Box style={styles.userDetails}>
          <ConnectedUsernames type="BodySemibold" colorFollowing={true} usernames={[username]} />
          <Box style={Styles.globalStyles.flexBoxRow}>
            <Meta title="please decide" style={styleCharm} backgroundColor={Styles.globalColors.orange} />
          </Box>
        </Box>
      </ClickableBox>
      <Box style={styles.floatingRolePickerContainer}>
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
          <Button label="Let in as..." onClick={onAccept} small={true} style={styles.letInButton} />
        </FloatingRolePicker>
        <Button
          label="Ignore"
          onClick={onIgnoreRequest}
          small={true}
          style={styles.ignoreButton}
          type="Danger"
        />
        {!Styles.isMobile && <Icon onClick={onChat} style={styles.icon} type="iconfont-chat" />}
      </Box>
    </Box>
  )
}

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
      width: 'initial',
    },
    isMobile: {
      width: '100%',
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
  userDetails: {
    ...Styles.globalStyles.flexBoxColumn,
    marginLeft: Styles.globalMargins.small,
  },
}))
