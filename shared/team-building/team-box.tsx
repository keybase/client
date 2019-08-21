import * as React from 'react'
import GoButton from './go-button'
import UserBubble from './user-bubble'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import {SelectedUser} from '../constants/types/team-building'
import {FloatingRolePicker, sendNotificationFooter} from '../teams/role-picker'
import {pluralize} from '../util/string'
import {RolePickerProps} from '.'

type Props = {
  allowPhoneEmail: boolean
  onChangeText: (newText: string) => void
  onEnterKeyDown: () => void
  onDownArrowKeyDown: () => void
  onUpArrowKeyDown: () => void
  teamSoFar: Array<SelectedUser>
  onRemove: (userId: string) => void
  onBackspace: () => void
  onFinishTeamBuilding: () => void
  searchString: string
  rolePickerProps?: RolePickerProps
}

const formatNameForUserBubble = (u: SelectedUser) => {
  let technicalName: string
  switch (u.service) {
    case 'keybase':
    case 'contact': // do not display "michal@keyba.se on contact".
      technicalName = u.username
      break
    default:
      technicalName = `${u.username} on ${u.service}`
      break
  }
  return `${technicalName} ${u.prettyName ? `(${u.prettyName})` : ''}`
}

class UserBubbleCollection extends React.PureComponent<{
  teamSoFar: Props['teamSoFar']
  onRemove: Props['onRemove']
}> {
  render() {
    return this.props.teamSoFar.map(u => (
      <UserBubble
        key={u.userId}
        onRemove={() => this.props.onRemove(u.userId)}
        username={u.username}
        service={u.service}
        prettyName={formatNameForUserBubble(u)}
      />
    ))
  }
}

const TeamBox = (props: Props) => {
  const addMorePrompt = props.teamSoFar.length === 1 && (
    <Kb.Text type="BodyTiny" style={{alignSelf: 'center', marginLeft: 28, maxWidth: 145}}>
      Keep adding people, or click Start when done.
    </Kb.Text>
  )
  return Styles.isMobile ? (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.container}>
      <Kb.ScrollView horizontal={true} alwaysBounceHorizontal={false}>
        <UserBubbleCollection teamSoFar={props.teamSoFar} onRemove={props.onRemove} />
        {addMorePrompt}
      </Kb.ScrollView>
    </Kb.Box2>
  ) : (
    <Kb.Box2 direction="horizontal" style={styles.container} fullWidth={true}>
      <Kb.Box2 direction="horizontal" style={styles.bubbles}>
        <Kb.ScrollView horizontal={true}>
          <Kb.Box2 direction="horizontal" fullHeight={true} style={styles.floatingBubbles}>
            <UserBubbleCollection teamSoFar={props.teamSoFar} onRemove={props.onRemove} />
            {addMorePrompt}
          </Kb.Box2>
        </Kb.ScrollView>
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" fullHeight={true} style={{marginLeft: 'auto'}}>
        {!!props.teamSoFar.length &&
          (props.rolePickerProps ? (
            <FloatingRolePicker
              open={props.rolePickerProps.showRolePicker}
              onConfirm={props.onFinishTeamBuilding}
              onSelectRole={props.rolePickerProps.onSelectRole}
              selectedRole={props.rolePickerProps.selectedRole}
              onCancel={() => props.rolePickerProps && props.rolePickerProps.changeShowRolePicker(false)}
              disabledRoles={props.rolePickerProps.disabledRoles}
              confirmLabel={`Add as ${pluralize(props.rolePickerProps.selectedRole, props.teamSoFar.length)}`}
              footerComponent={sendNotificationFooter(
                'Announce them in team chats',
                props.rolePickerProps.sendNotification,
                props.rolePickerProps.changeSendNotification
              )}
            >
              <GoButton
                label="Add"
                onClick={() => props.rolePickerProps && props.rolePickerProps.changeShowRolePicker(true)}
              />
            </FloatingRolePicker>
          ) : (
            <GoButton label="Start" onClick={props.onFinishTeamBuilding} />
          ))}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  bubbles: Styles.platformStyles({
    isElectron: {
      overflow: 'hidden',
      paddingBottom: Styles.globalMargins.xsmall,
      paddingTop: Styles.globalMargins.xsmall,
    },
  }),
  container: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.blueGrey,
    },
    isElectron: {
      paddingLeft: Styles.globalMargins.xsmall,
      paddingRight: Styles.globalMargins.xsmall,
    },
    isMobile: {
      borderBottomColor: Styles.globalColors.black_10,
      borderBottomWidth: 1,
      borderStyle: 'solid',
      minHeight: 90,
      paddingBottom: Styles.globalMargins.tiny,
      paddingTop: Styles.globalMargins.tiny,
    },
  }),
  floatingBubbles: Styles.platformStyles({
    isElectron: {
      justifyContent: 'flex-end',
    },
  }),
  search: Styles.platformStyles({
    common: {
      flex: 1,
      flexWrap: 'wrap',
    },
    isElectron: {
      ...Styles.globalStyles.rounded,
      backgroundColor: Styles.globalColors.white,
      borderColor: Styles.globalColors.black_20,
      borderStyle: 'solid',
      borderWidth: 1,
      maxHeight: 170,
      minHeight: 40,
      overflowY: 'scroll',
    },
    isMobile: {
      borderBottomColor: Styles.globalColors.black_10,
      borderBottomWidth: 1,
      borderStyle: 'solid',
      minHeight: 48,
    },
  }),
  searchIcon: {
    alignSelf: 'center',
    marginLeft: 10,
  },
})

export default TeamBox
