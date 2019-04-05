// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {map} from 'lodash-es'
export type Role = 'Owners' | 'Admins' | 'Writers' | 'Readers'

// Controls the ordering of the role picker
const orderedRoles = ['Owners', 'Admins', 'Writers', 'Readers']

type DisabledReason = string

export type Props = {
  disabledRoles?: {[key: Role]: DisabledReason},
  headerText?: string,
  // If provided, a cancel button will appear
  onCancel?: () => void,
  // If provided, a let in button will appear
  onLetIn?: () => void,
  onSelectRole: (role: Role) => void,
  selectedRole?: ?Role,
}

type RoleRowProps = {
  body: React.Node,
  disabledReason: ?React.Node,
  icon: ?React.Node,
  selected: boolean,
  title: React.Node,
}
const RoleRow = (p: RoleRowProps) => (
  <Kb.Box2
    direction={'vertical'}
    style={Styles.collapseStyles([p.selected ? styles.selectedRow : undefined, styles.row])}
  >
    <Kb.Box2 direction={'vertical'} style={p.disabledReason ? styles.disabledRow : undefined}>
      {!!p.selected && (
        <Kb.Icon type="iconfont-check" style={styles.checkIcon} color={Styles.globalColors.white} />
      )}
      <Kb.Box2 alignSelf={'flex-start'} direction={'horizontal'}>
        {p.icon}
        {p.title}
      </Kb.Box2>
      {p.body}
    </Kb.Box2>
    {p.disabledReason}
  </Kb.Box2>
)

const rolesMetaInfo = (selectedRole: ?Role): {[key: Role]: {body: string, icon: ?React.Node}} => ({
  Admins: {
    body:
      'Can manage team members roles, create subteams and channels, and write and read in chats and folders.',
    icon: (
      <Kb.Icon
        style={styles.roleIcon}
        type={'iconfont-crown-admin'}
        color={selectedRole === 'Admins' ? Styles.globalColors.white : undefined}
      />
    ),
  },
  Owners: {
    body: 'Gets all the admin rights + can delete team. (A team can have multiple owners.)',
    icon: (
      <Kb.Icon
        style={styles.roleIcon}
        type={'iconfont-crown-owner'}
        color={selectedRole === 'Owners' ? Styles.globalColors.white : Styles.globalColors.yellow2}
      />
    ),
  },
  Readers: {
    body: 'Can write in chats but read only in folders.',
    icon: null,
  },
  Writers: {
    body: 'Can create channels, and write and read in chats and folders.',
    icon: null,
  },
})

const roleElementHelper = (selectedRole: ?Role) =>
  orderedRoles
    .map(role => [role, rolesMetaInfo(selectedRole)[role]])
    .map(([role, roleInfo]) => ({
      body: (
        <Kb.Text type="BodySmall" style={styles.text} negative={selectedRole === role}>
          {roleInfo.body}
        </Kb.Text>
      ),
      icon: roleInfo.icon,
      role,
      title: (
        <Kb.Text type="Body" style={styles.text} negative={selectedRole === role}>
          {role}
        </Kb.Text>
      ),
    }))

const disabledTextHelper = (text: string) => (
  <Kb.Text type="BodySmallError" style={styles.text}>
    {text}
  </Kb.Text>
)

const headerTextHelper = (text: ?string) =>
  !!text && (
    <>
      <Kb.Text type="BodySmall" style={styles.headerText}>
        {text}
      </Kb.Text>
      <Kb.Divider />
    </>
  )

const footButtonsHelper = (onCancel, onLetIn) => (
  <Kb.Box2
    direction="horizontal"
    style={{paddingBottom: Styles.globalMargins.small, paddingTop: Styles.globalMargins.tiny}}
  >
    {!!onCancel && (
      <Kb.Button
        style={{marginRight: Styles.globalMargins.tiny}}
        type="Secondary"
        label="Cancel"
        onClick={onCancel}
      />
    )}
    {!!onLetIn && <Kb.Button type="Primary" label="Let In" onClick={onLetIn} />}
  </Kb.Box2>
)

const RolePicker = (props: Props) => {
  return (
    <Kb.Box2 direction="vertical" alignItems={'stretch'} style={styles.container}>
      {headerTextHelper(props.headerText)}
      {map(
        roleElementHelper(props.selectedRole),
        // $FlowIssue, the library type for map is wrong
        ({role, ...nodeMap}: {[key: string]: React.Node, role: Role}): React.Node => (
          <Kb.ClickableBox
            onClick={
              props.disabledRoles && props.disabledRoles[role] ? undefined : () => props.onSelectRole(role)
            }
          >
            <RoleRow
              selected={props.selectedRole === role}
              key={role}
              title={nodeMap.title}
              body={nodeMap.body}
              icon={nodeMap.icon}
              disabledReason={
                props.disabledRoles &&
                props.disabledRoles[role] &&
                disabledTextHelper(props.disabledRoles[role])
              }
            />
          </Kb.ClickableBox>
        )
      ).map((row, i, arr) => [row, i === arr.length - 1 ? null : <Kb.Divider key={i} />])}
      {footButtonsHelper(props.onCancel, props.onLetIn)}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  checkIcon: {
    left: 8,
    paddingTop: 2,
    position: 'absolute',
  },
  container: Styles.platformStyles({
    common: {
      borderColor: Styles.globalColors.blue,
      borderRadius: Styles.borderRadius,
      borderStyle: 'solid',
      borderWidth: 1,
    },
    isElectron: {
      boxShadow: `0 0 3px 0 rgba(0, 0, 0, 0.15), 0 0 5px 0 ${Styles.globalColors.black_20_on_white}`,
      width: 267,
    },
  }),
  disabledRow: {
    opacity: 0.4,
  },
  headerText: {
    alignSelf: 'center',
    paddingBottom: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.tiny,
  },
  roleIcon: {
    paddingRight: Styles.globalMargins.xtiny,
  },
  row: Styles.platformStyles({
    common: {
      paddingBottom: Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.mediumLarge,
      paddingRight: Styles.globalMargins.small,
      paddingTop: Styles.globalMargins.tiny,
      position: 'relative',
    },
    isElectron: Styles.desktopStyles.clickable,
  }),
  selectedRow: {
    backgroundColor: Styles.globalColors.blue,
  },
  text: {
    textAlign: 'left',
  },
})

export default RolePicker
