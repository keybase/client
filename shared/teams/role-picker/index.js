// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Flow from '../../util/flow'
import {map, capitalize} from 'lodash-es'
import type {Position} from '../../common-adapters/relative-popup-hoc.types'
import {type TeamRoleType as Role} from '../../constants/types/teams'
import type {StylesCrossPlatform} from '../../styles/css'
// Controls the ordering of the role picker
const orderedRoles = ['owner', 'admin', 'writer', 'reader']

type DisabledReason = string

export type Props = {|
  disabledRoles?: {[key: Role]: DisabledReason},
  headerText?: string,
  // If provided, a cancel button will appear
  onCancel?: () => void,
  onConfirm: (selectedRole: Role) => void,
  // Defaults to "Make ${selectedRole}"
  confirmLabel?: string,
  onSelectRole: (role: Role) => void,
  // The role they started with
  footerComponent?: React.Node,
  presetRole?: ?Role,
  selectedRole?: ?Role,
|}

type RoleRowProps = {
  body: React.Node,
  disabledReason: ?React.Node,
  icon: ?React.Node,
  selected: boolean,
  title: React.Node,
  onSelect: ?() => void,
}
const RoleRow = (p: RoleRowProps) => (
  <Kb.Box2 direction={'vertical'} fullWidth={true} alignItems={'flex-start'} style={styles.row}>
    <Kb.Box2 direction={'vertical'} fullWidth={true} style={styles.rowChild}>
      <Kb.Box2
        direction={'horizontal'}
        alignItems={'center'}
        fullWidth={true}
        style={p.disabledReason ? styles.disabledRow : undefined}
      >
        <Kb.RadioButton label="" onSelect={p.onSelect || (() => {})} selected={p.selected} />
        {p.icon}
        {p.title}
      </Kb.Box2>
      <Kb.Box style={p.disabledReason ? undefined : styles.rowBody}>
        {p.body}
        {p.disabledReason}
      </Kb.Box>
    </Kb.Box2>
  </Kb.Box2>
)

const rolesMetaInfo = (
  infoForRole: Role,
  selectedRole: ?Role
): {cans: Array<string>, cants: Array<string>, icon: ?React.Node} => {
  switch (infoForRole) {
    case 'admin':
      return {
        cans: [
          'Can manage team members roles',
          'Can create subteams and channels',
          'Can write and read in chats and folders',
        ],
        cants: [`Can't delete the team`],
        icon: (
          <Kb.Icon
            boxStyle={{paddingBottom: 0}}
            style={styles.roleIcon}
            type={'iconfont-crown-admin'}
            sizeType={'Small'}
          />
        ),
      }
    case 'owner':
      return {
        cans: [
          'Can manage team members roles',
          'Can create subteams and channels',
          'Can write and read in chats and folders',
          'Can delete team',
        ],
        cants: [],
        extra: ['A team can have multiple owners'],
        icon: (
          <Kb.Icon
            style={styles.roleIcon}
            boxStyle={{paddingBottom: 0}}
            type={'iconfont-crown-owner'}
            sizeType={'Small'}
          />
        ),
      }
    case 'reader':
      return {
        cans: ['Can write in chats but read only in folders'],
        cants: [
          `Can't create channels`,
          `Can't create subteams`,
          `Can't add and remove members`,
          `Can't manage team members' roles`,
          `Can't delete the team`,
        ],
        icon: null,
      }
    case 'writer':
      return {
        cans: ['Can create channels', 'Can write and read in chats and folders'],
        cants: [
          `Can't create subteams`,
          `Can't add and remove members`,
          `Can't manage team members' roles`,
          `Can't delete the team`,
        ],
        icon: null,
      }
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(infoForRole)
      return {}
  }
}

const roleAbilities = (
  abilities: Array<string>,
  canDo: boolean,
  addFinalPadding: boolean,
  selected: boolean
): Array<React.Node> => {
  return abilities.map((ability, i) => (
    <Kb.Box2
      key={ability}
      direction="horizontal"
      alignItems="flex-start"
      fullWidth={true}
      style={
        addFinalPadding && i === abilities.length - 1 ? {paddingBottom: Styles.globalMargins.tiny} : undefined
      }
    >
      <Kb.Icon
        type={canDo ? 'iconfont-check' : 'iconfont-close'}
        sizeType="Tiny"
        style={Styles.isMobile ? styles.abilityCheck : undefined}
        boxStyle={!Styles.isMobile ? styles.abilityCheck : undefined}
        color={canDo ? Styles.globalColors.green : Styles.globalColors.red}
      />
      <Kb.Text type="BodySmall">{ability}</Kb.Text>
    </Kb.Box2>
  ))
}

const roleElementHelper = (selectedRole: ?Role) =>
  orderedRoles
    .map(role => [role, rolesMetaInfo(role, selectedRole)])
    .map(([role, roleInfo]) => ({
      body:
        selectedRole === role
          ? [
              roleAbilities(roleInfo.cans, true, roleInfo.cants.length === 0, selectedRole === role),
              roleAbilities(roleInfo.cants, false, true, selectedRole === role),
            ]
          : undefined,
      icon: roleInfo.icon,
      role,
      title: (
        <Kb.Text type="BodyBig" style={styles.text}>
          {capitalize(role)}
        </Kb.Text>
      ),
    }))

const disabledTextHelper = (text: string) => (
  <Kb.Text type="BodySmall" style={styles.text}>
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

const footerButtonsHelper = (onCancel, onConfirm, confirmLabel) => (
  <Kb.ButtonBar direction="row" fullWidth={true} style={styles.footerButtonBar}>
    {!!onCancel && <Kb.Button type="Dim" label="Cancel" onClick={onCancel} />}
    <Kb.Button fullWidth={true} disabled={!onConfirm} label={confirmLabel} onClick={onConfirm} />
  </Kb.ButtonBar>
)

const confirmLabelHelper = (presetRole: ?Role, selectedRole: ?Role): string => {
  let label = selectedRole && selectedRole.toLowerCase()
  if (label && presetRole === selectedRole) {
    return `Saved`
  }

  return label ? `Make ${label}` : `Pick a role`
}

const RolePicker = (props: Props) => {
  let selectedRole = props.selectedRole || props.presetRole
  return (
    <Kb.Box2 direction="vertical" alignItems={'stretch'} style={styles.container}>
      {headerTextHelper(props.headerText)}
      {map(
        roleElementHelper(selectedRole),
        // $FlowIssue, the library type for map is wrong
        ({role, ...nodeMap}: {[key: string]: React.Node, role: Role}): React.Node => {
          const onSelect =
            props.disabledRoles && props.disabledRoles[role] ? undefined : () => props.onSelectRole(role)
          return (
            <Kb.ClickableBox key={role} onClick={onSelect}>
              <RoleRow
                selected={selectedRole === role}
                title={nodeMap.title}
                body={nodeMap.body}
                icon={nodeMap.icon}
                onSelect={onSelect}
                disabledReason={
                  props.disabledRoles &&
                  props.disabledRoles[role] &&
                  disabledTextHelper(props.disabledRoles[role])
                }
              />
            </Kb.ClickableBox>
          )
        }
      ).map((row, i, arr) => [row, i === arr.length - 1 ? null : <Kb.Divider key={i} />])}
      <Kb.Box2 fullWidth={true} direction="vertical" style={styles.footer}>
        {props.footerComponent}
        {footerButtonsHelper(
          props.onCancel,
          selectedRole && props.selectedRole !== props.presetRole
            ? () => props.onConfirm(selectedRole)
            : undefined,
          props.confirmLabel || confirmLabelHelper(props.presetRole, selectedRole)
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  abilityCheck: Styles.platformStyles({
    common: {
      paddingRight: Styles.globalMargins.tiny,
    },
    isElectron: {
      paddingTop: 6,
    },
    isMobile: {paddingTop: 4},
  }),
  checkIcon: {
    left: -24,
    paddingTop: 2,
    position: 'absolute',
  },
  container: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
    },
    isElectron: {
      borderColor: Styles.globalColors.blue,
      borderRadius: Styles.borderRadius,
      borderStyle: 'solid',
      borderWidth: 1,
      boxShadow: `0 0 3px 0 rgba(0, 0, 0, 0.15), 0 0 5px 0 ${Styles.globalColors.black_20_on_white}`,
      minHeight: 350,
      width: 310,
    },
    isMobile: {
      flex: 1,
    },
  }),
  disabledRow: {
    opacity: 0.4,
  },
  footer: {
    flexGrow: 2,
    justifyContent: 'flex-end',
    paddingBottom: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
  },
  footerButtonBar: {
    alignItems: 'flex-end',
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
  },
  headerText: {
    alignSelf: 'center',
    paddingBottom: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.tiny,
  },
  roleIcon: {
    paddingRight: Styles.globalMargins.xtiny,
  },
  row: {
    position: 'relative',
  },
  rowBody: Styles.platformStyles({
    // Width of the radio button. Used to align text with title
    isElectron: {
      paddingLeft: 22,
    },
    isMobile: {
      paddingLeft: 30,
    },
  }),
  rowChild: Styles.platformStyles({
    common: {
      paddingBottom: Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
      paddingTop: Styles.globalMargins.tiny,
    },
  }),
  text: {
    textAlign: 'left',
  },
})

// Helper to use this as a floating box
export type FloatingProps = {|
  position?: Position,
  children?: React.ChildrenArray<any>,
  floatingContainerStyle?: StylesCrossPlatform,
  open: boolean,
  ...Props,
|}

type S = {|
  ref: ?any,
|}

export class FloatingRolePicker extends React.Component<FloatingProps, S> {
  state = {ref: null}
  _returnRef = () => this.state.ref
  _setRef = ref => this.setState({ref})
  render() {
    const {position, children, open, floatingContainerStyle, onCancel, ...props} = this.props
    return (
      <>
        <Kb.Box ref={this._setRef}>{children}</Kb.Box>
        {open && (
          <Kb.FloatingBox
            attachTo={this.state.ref && this._returnRef}
            position={position || 'top center'}
            onHidden={onCancel}
          >
            <Kb.Box2 direction={'vertical'} fullHeight={Styles.isMobile} style={floatingContainerStyle}>
              {Styles.isMobile && (
                <Kb.HeaderHocHeader onLeftAction={onCancel} leftAction={'cancel'} title="Pick a role" />
              )}
              <RolePicker {...props} onCancel={Styles.isMobile ? undefined : onCancel} />
            </Kb.Box2>
          </Kb.FloatingBox>
        )}
      </>
    )
  }
}

// Helper since it's common for some users to want this
export const sendNotificationFooter = (
  label: string,
  checked: boolean,
  onCheck: (nextVal: boolean) => void
) => (
  <Kb.Box2
    direction="horizontal"
    fullWidth={true}
    centerChildren={true}
    style={{
      paddingBottom: Styles.globalMargins.tiny,
      paddingTop: Styles.globalMargins.tiny,
    }}
  >
    <Kb.Checkbox checked={checked} onCheck={onCheck} label={label} />
  </Kb.Box2>
)

export const roleIconMap = {
  admin: 'iconfont-crown-admin',
  owner: 'iconfont-crown-owner',
  reader: '',
  writer: '',
}

export default RolePicker
