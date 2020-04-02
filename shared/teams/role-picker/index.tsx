import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import map from 'lodash/map'
import capitalize from 'lodash/capitalize'
import {Position} from '../../common-adapters/relative-popup-hoc.types'
import {TeamRoleType} from '../../constants/types/teams'
import {StylesCrossPlatform} from '../../styles/css'
// Controls the ordering of the role picker
const orderedRoles = ['owner', 'admin', 'writer', 'reader'] as const

// TODO include bot roles in here; this is short term to allow bots to show up in the gui
type Role = Exclude<TeamRoleType, 'bot' | 'restrictedbot'>
const filterRole = (r: TeamRoleType | null | undefined): Role | null =>
  r === 'bot' || r === 'restrictedbot' || !r ? null : r

type DisabledReason = string

export type Props = {
  disabledRoles?: {[K in Role]?: DisabledReason}
  headerText?: string
  onCancel?: () => void // If provided, a cancel button will appear
  onConfirm: (selectedRole: Role) => void
  confirmLabel?: string // Defaults to "Make ${selectedRole}"
  onSelectRole: (role: Role) => void
  footerComponent?: React.ReactNode
  presetRole?: TeamRoleType | null
  selectedRole?: TeamRoleType | null
  waiting?: boolean
}

type RoleRowProps = {
  body: React.ReactNode
  disabledReason: React.ReactNode | null
  icon: React.ReactNode | null
  selected: boolean
  title: React.ReactNode
  onSelect?: () => void
}

const RoleRow = (p: RoleRowProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} alignItems="flex-start" style={styles.row}>
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.rowChild}>
      <Kb.Box2
        direction="horizontal"
        alignItems="center"
        fullWidth={true}
        style={p.disabledReason ? styles.disabledRow : undefined}
      >
        <Kb.RadioButton
          label=""
          style={styles.radioButton}
          onSelect={p.onSelect || (() => {})}
          selected={p.selected}
        />
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

type RolesMetaInfo = {
  cans: Array<string>
  cants: Array<string>
  extra?: Array<string>
  icon: React.ReactNode | null
}
const rolesMetaInfo = (infoForRole: Role): RolesMetaInfo => {
  switch (infoForRole) {
    case 'admin':
      return {
        cans: [
          `Can create chat channels`,
          `Can create subteams`,
          `Can add and remove members`,
          `Can manage team members' roles`,
          `Can write and read in chats and folders`,
        ],
        cants: [`Can't delete the team`],
        icon: (
          <Kb.Icon
            boxStyle={{paddingBottom: 0}}
            style={styles.roleIcon}
            type="iconfont-crown-admin"
            sizeType="Small"
          />
        ),
      }
    case 'owner':
      return {
        cans: [
          `Can create chat channels`,
          `Can create subteams`,
          `Can add and remove members`,
          `Can manage team members' roles`,
          `Can write and read in chats and folders`,
          `Can delete team`,
        ],
        cants: [],
        extra: ['A team can have multiple owners'],
        icon: (
          <Kb.Icon
            style={styles.roleIcon}
            boxStyle={{paddingBottom: 0}}
            type="iconfont-crown-owner"
            sizeType="Small"
          />
        ),
      }
    case 'reader':
      return {
        cans: ['Can write in chats but read only in folders'],
        cants: [
          `Can't create chat channels`,
          `Can't create subteams`,
          `Can't add and remove members`,
          `Can't manage team members' roles`,
          `Can't delete the team`,
        ],
        icon: null,
      }
    case 'writer':
      return {
        cans: ['Can write and read in chats and folders', 'Can create chat channels'],
        cants: [
          `Can't create subteams`,
          `Can't add and remove members`,
          `Can't manage team members' roles`,
          `Can't delete the team`,
        ],
        icon: null,
      }
    default:
      throw new Error(`Unexpected role: ${infoForRole}`)
  }
}

const roleAbilities = (
  abilities: Array<string>,
  canDo: boolean,
  addFinalPadding: boolean
): Array<React.ReactNode> => {
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

const roleElementHelper = (selectedRole: Role | null) =>
  orderedRoles
    .map(role => [role, rolesMetaInfo(role as Role)])
    .map(([role, info]) => {
      // Using as to avoid lots of ts-ignore
      const roleInfo = info as RolesMetaInfo
      return {
        body:
          selectedRole === role
            ? [
                roleAbilities(roleInfo.cans, true, roleInfo.cants.length === 0),
                roleAbilities(roleInfo.cants, false, true),
              ]
            : undefined,
        icon: roleInfo.icon,
        role,
        title: (
          <Kb.Text type="BodyBig" style={styles.text}>
            {capitalize(role as string)}
          </Kb.Text>
        ),
      }
    })

const disabledTextHelper = (text: string) => (
  <Kb.Text type="BodySmall" style={styles.text}>
    {text}
  </Kb.Text>
)

const headerTextHelper = (text: string | undefined) =>
  !!text && (
    <>
      <Kb.Text type="BodySmall" style={styles.headerText}>
        {text}
      </Kb.Text>
      <Kb.Divider />
    </>
  )

const footerButtonsHelper = (
  onCancel: undefined | (() => void),
  onConfirm: undefined | (() => void),
  confirmLabel: string,
  waiting: boolean | undefined
) => (
  <Kb.ButtonBar direction="row" fullWidth={true} style={styles.footerButtonBar}>
    {!!onCancel && <Kb.Button type="Dim" label="Cancel" onClick={onCancel} disabled={waiting} />}
    <Kb.Button
      fullWidth={true}
      disabled={!onConfirm}
      waiting={waiting}
      label={confirmLabel}
      onClick={onConfirm}
    />
  </Kb.ButtonBar>
)

const confirmLabelHelper = (presetRole: Role | null, selectedRole: Role | null): string => {
  const label = selectedRole && selectedRole.toLowerCase()
  if (label && presetRole === selectedRole) {
    return `Saved`
  }

  return label ? `Make ${label}` : `Pick a role`
}

const RolePicker = (props: Props) => {
  const selectedRole = filterRole(props.selectedRole || props.presetRole)
  return (
    <Kb.Box2 direction="vertical" alignItems="stretch" style={styles.container}>
      {headerTextHelper(props.headerText)}
      {map(
        roleElementHelper(selectedRole || null),
        ({role, ...nodeMap}: {[K in string]: React.ReactNode}): React.ReactNode => {
          // Using as to avoid lots of ts-ignore.
          const disabledRole = role as Role
          const disabled = props.disabledRoles && props.disabledRoles[disabledRole]
          const onSelect = disabled ? undefined : () => props.onSelectRole(disabledRole)
          return (
            <Kb.ClickableBox key={role as string} onClick={onSelect}>
              <RoleRow
                selected={selectedRole === role}
                title={nodeMap.title}
                body={nodeMap.body}
                icon={nodeMap.icon}
                onSelect={onSelect}
                disabledReason={disabled ? disabledTextHelper(disabled) : undefined}
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
            ? () => selectedRole && props.onConfirm(selectedRole)
            : undefined,
          props.confirmLabel || confirmLabelHelper(filterRole(props.presetRole), selectedRole || null),
          props.waiting
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
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
      checkbox: {
        ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
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
        minHeight: undefined,
        paddingLeft: Styles.globalMargins.small,
        paddingRight: Styles.globalMargins.small,
      },
      headerText: {
        alignSelf: 'center',
        paddingBottom: Styles.globalMargins.tiny,
        paddingTop: Styles.globalMargins.tiny,
      },
      radioButton: Styles.platformStyles({
        isMobile: {paddingRight: Styles.globalMargins.tiny},
      }),
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
          paddingLeft: 38,
        },
      }),
      rowChild: Styles.platformStyles({
        common: {
          paddingBottom: Styles.globalMargins.tiny,
          paddingLeft: Styles.globalMargins.small,
          paddingRight: Styles.globalMargins.small,
          paddingTop: Styles.globalMargins.tiny,
        },

        isMobile: {
          paddingBottom: Styles.globalMargins.small,
          paddingTop: Styles.globalMargins.small,
        },
      }),
      scroll: {
        backgroundColor: Styles.globalColors.white,
      },
      text: {
        textAlign: 'left',
      },
    } as const)
)

// Helper to use this as a floating box
export type FloatingProps = {
  position?: Position
  children?: React.ReactNode
  floatingContainerStyle?: StylesCrossPlatform
  open: boolean
} & Props

export class FloatingRolePicker extends React.Component<FloatingProps, {ref: Kb.Box | null}> {
  state = {ref: null}
  _returnRef = () => this.state.ref
  _setRef = (ref: Kb.Box | null) => this.setState({ref})
  render() {
    const {position, children, open, floatingContainerStyle, onCancel, ...props} = this.props
    const picker = <RolePicker {...props} onCancel={Styles.isMobile ? undefined : onCancel} />
    const wrappedPicker = Styles.isMobile ? (
      <Kb.ScrollView style={styles.scroll}>{picker}</Kb.ScrollView>
    ) : (
      picker
    )
    return (
      <>
        {children}
        <Kb.Box ref={this._setRef} />
        {open && (
          <Kb.FloatingBox
            attachTo={this._returnRef}
            position={position || 'top center'}
            onHidden={onCancel}
            hideKeyboard={true}
          >
            <Kb.Box2 direction="vertical" fullHeight={Styles.isMobile} style={floatingContainerStyle}>
              {Styles.isMobile && (
                <Kb.HeaderHocHeader onLeftAction={onCancel} leftAction="cancel" title="Pick a role" />
              )}
              {wrappedPicker}
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
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.checkbox}>
    <Kb.Checkbox checked={checked} onCheck={onCheck} label={label} />
  </Kb.Box2>
)

// Helper for navigating roles with keyboard arrows
export const nextRoleDown = (currentRole: Role): Role =>
  orderedRoles[(orderedRoles.indexOf(currentRole) + 1) % orderedRoles.length]
export const nextRoleUp = (currentRole: Role): Role =>
  orderedRoles[(orderedRoles.length + (orderedRoles.indexOf(currentRole) - 1)) % orderedRoles.length]

export const roleIconMap = {
  admin: 'iconfont-crown-admin',
  owner: 'iconfont-crown-owner',
  reader: undefined,
  writer: undefined,
} as const

export default RolePicker
