import * as React from 'react'
import * as Types from '../../../../constants/types/teams'
import {Avatar, Box, Button, ClickableBox, Icon, Meta, ConnectedUsernames} from '../../../../common-adapters'
import {FloatingRolePicker} from '../../../role-picker'
import * as Styles from '../../../../styles'

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
    <Box
      style={{
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        flexDirection: Styles.isMobile ? 'column' : 'row',
        flexShrink: 0,
        height: Styles.isMobile ? 112 : 48,
        padding: Styles.globalMargins.tiny,
        width: '100%',
      }}
    >
      <ClickableBox
        style={{
          ...Styles.globalStyles.flexBoxRow,
          alignItems: 'center',
          flexGrow: 1,
          flexShrink: 0,
          width: Styles.isMobile ? '100%' : 'initial',
        }}
        onClick={() => onOpenProfile(username)}
      >
        <Avatar username={username} size={Styles.isMobile ? 48 : 32} />
        <Box style={{...Styles.globalStyles.flexBoxColumn, marginLeft: Styles.globalMargins.small}}>
          <ConnectedUsernames type="BodySemibold" colorFollowing={true} usernames={[username]} />
          <Box style={Styles.globalStyles.flexBoxRow}>
            <Meta title="please decide" style={styleCharm} backgroundColor={Styles.globalColors.orange} />
          </Box>
        </Box>
      </ClickableBox>
      <Box
        style={{
          ...Styles.globalStyles.flexBoxRow,
          alignItems: 'center',
          marginTop: Styles.isMobile ? Styles.globalMargins.tiny : 0,
        }}
      >
        <FloatingRolePicker
          selectedRole={props.selectedRole}
          onSelectRole={props.onSelectRole}
          floatingContainerStyle={styles.floatingRolePicker}
          footerComponent={props.footerComponent}
          onConfirm={props.onConfirmRolePicker}
          onCancel={props.onCancelRolePicker}
          position={'bottom left'}
          open={props.isRolePickerOpen}
          disabledRoles={props.disabledReasonsForRolePicker}
        >
          <Button
            label="Let in as..."
            onClick={onAccept}
            small={true}
            style={{backgroundColor: Styles.globalColors.green, marginLeft: Styles.globalMargins.xtiny}}
          />
        </FloatingRolePicker>
        <Button
          label="Ignore"
          onClick={onIgnoreRequest}
          small={true}
          style={{marginLeft: Styles.globalMargins.xtiny}}
          type="Danger"
        />
        {!Styles.isMobile && (
          <Icon
            onClick={onChat}
            style={{marginLeft: Styles.globalMargins.small, marginRight: Styles.globalMargins.tiny}}
            type="iconfont-chat"
          />
        )}
      </Box>
    </Box>
  )
}

const styleCharm = {
  alignSelf: 'center',
  marginRight: Styles.globalMargins.xtiny,
} as const

const styles = Styles.styleSheetCreate({
  floatingRolePicker: Styles.platformStyles({
    isElectron: {
      position: 'relative',
      top: -32,
    },
  }),
})
