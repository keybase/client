import * as React from 'react'
import {useSpring, animated} from 'react-spring'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import capitalize from 'lodash/capitalize'
import {pluralize} from '../../util/string'
import type {TeamRoleType} from '../../constants/types/teams'
import type {StylesCrossPlatform} from '../../styles/css'

// Controls the ordering of the role picker
const orderedRoles: Array<Role<true>> = ['owner', 'admin', 'writer', 'reader', 'setIndividually']

// TODO include bot roles in here; this is short term to allow bots to show up in the gui
type BaseRole = Exclude<TeamRoleType, 'bot' | 'restrictedbot'>
type Role<IncludeSetIndividually> = IncludeSetIndividually extends true
  ? BaseRole | 'setIndividually'
  : BaseRole

type MaybeRole<IncludeSetIndividually> =
  | TeamRoleType
  | null
  | undefined
  | (IncludeSetIndividually extends true ? 'setIndividually' : undefined)

function filterRole<IncludeSetIndividually extends boolean>(
  r: MaybeRole<IncludeSetIndividually>
): Role<IncludeSetIndividually> | null {
  return r === 'bot' || r === 'restrictedbot' || !r ? null : (r as Role<IncludeSetIndividually> | null)
}

type DisabledReason = string | null // null means don't show it at all

export type Props<IncludeSetIndividually extends boolean> = {
  disabledRoles?: {[K in Role<IncludeSetIndividually>]?: DisabledReason}
  onCancel?: () => void // If provided, a cancel button will appear
  onConfirm: (selectedRole: Role<IncludeSetIndividually>) => void
  footerComponent?: React.ReactNode
  presetRole?: MaybeRole<IncludeSetIndividually>
  plural?: boolean
  includeSetIndividually?: IncludeSetIndividually extends true ? boolean : false
  waiting?: boolean
}

type RoleRowProps = {
  body: React.ReactNode
  disabledReason?: string
  icon: React.ReactNode | null
  selected: boolean
  title: string
  onSelect?: () => void
}

const RoleRow = (p: RoleRowProps) => {
  const row = (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.rowChild}>
      <Kb.Box2
        direction="horizontal"
        alignItems="center"
        fullWidth={true}
        style={Styles.collapseStyles([p.disabledReason ? styles.disabledRow : undefined, styles.rowPadding])}
      >
        <Kb.RadioButton
          label=""
          style={styles.radioButton}
          onSelect={p.onSelect || (() => {})}
          selected={p.selected}
        />
        {p.icon}
        <Kb.Text type="BodyBig" style={styles.text}>
          {p.title}
        </Kb.Text>
      </Kb.Box2>
      <Kb.Box2
        style={Styles.collapseStyles([styles.rowBody])}
        direction="vertical"
        gap="xxtiny"
        gapStart={true}
      >
        {!p.disabledReason && p.body}
      </Kb.Box2>
    </Kb.Box2>
  )

  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      alignItems="flex-start"
      style={p.selected ? styles.rowSelected : styles.row}
    >
      {p.disabledReason ? (
        <Kb.WithTooltip tooltip={p.disabledReason} showOnPressMobile={true}>
          {row}
        </Kb.WithTooltip>
      ) : (
        row
      )}
    </Kb.Box2>
  )
}

type RoleRowWrapperProps = {
  selected: boolean
  onSelect?: () => void
  disabledReason?: string
  role: Role<true>
  plural: boolean
}

const AnimatedClickableBox = animated(Kb.ClickableBox)

const RoleRowWrapper = (props: RoleRowWrapperProps) => {
  const {role, selected, onSelect, disabledReason, plural} = props
  const roleInfo = rolesMetaInfo(role)

  // @ts-ignore spring is confused that I'm animating different things on desktop vs mobile
  const style = useSpring({
    ...(Styles.isMobile ? {flexGrow: selected ? 1 : 0} : {height: selected ? 160 : 42}),
    config: {tension: Styles.isMobile ? 250 : 260},
  }) as Styles.StylesCrossPlatform
  return (
    <AnimatedClickableBox onClick={onSelect} style={Styles.collapseStyles([styles.roleRow, style])}>
      <Kb.Divider />
      <RoleRow
        selected={selected}
        title={
          role === 'setIndividually'
            ? 'Set Individually'
            : pluralize(capitalize(role as string), plural ? 2 : 1)
        }
        body={[
          roleAbilities(roleInfo.cans, true, roleInfo.cants.length === 0),
          roleAbilities(roleInfo.cants, false, true),
        ]}
        icon={roleInfo.icon}
        onSelect={onSelect}
        disabledReason={disabledReason}
      />
    </AnimatedClickableBox>
  )
}

type RolesMetaInfo = {
  cans: Array<string>
  cants: Array<string>
  extra?: Array<string>
  icon: React.ReactNode | null
}
const rolesMetaInfo = (infoForRole: Role<true>): RolesMetaInfo => {
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
    case 'setIndividually':
      return {
        cans: [],
        cants: [],
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
        type={canDo ? 'iconfont-check' : 'iconfont-block'}
        sizeType="Tiny"
        style={Styles.isMobile ? styles.abilityCheck : undefined}
        boxStyle={!Styles.isMobile ? styles.abilityCheck : undefined}
        color={canDo ? Styles.globalColors.green : Styles.globalColors.black_50}
      />
      <Kb.Text type="BodySmall" style={canDo ? styles.canText : undefined}>
        {ability}
      </Kb.Text>
    </Kb.Box2>
  ))
}

const Header = () => (
  <Kb.Box2 direction="horizontal" style={styles.header}>
    <Kb.Text type="Header">Pick a role</Kb.Text>
  </Kb.Box2>
)

const RolePicker = <IncludeSetIndividually extends boolean>(props: Props<IncludeSetIndividually>) => {
  const filteredRole = filterRole(props.presetRole)
  const [selectedRole, setSelectedRole] = React.useState<Role<IncludeSetIndividually>>(
    filteredRole ?? ('reader' as Role<IncludeSetIndividually>)
  )
  React.useEffect(() => {
    const newRole = filterRole(props.presetRole) ?? ('reader' as Role<IncludeSetIndividually>)
    setSelectedRole(newRole)
  }, [props.presetRole])

  // as because convincing TS that filtering this makes it a different type is hard
  const roles = orderedRoles.filter(r => props.includeSetIndividually || r !== 'setIndividually') as Array<
    Role<IncludeSetIndividually>
  >
  return (
    <Kb.Box2 direction="vertical" alignItems="stretch" style={styles.container} fullHeight={Styles.isMobile}>
      {!Styles.isMobile && <Header />}
      <Kb.ScrollView style={styles.innerScroll}>
        {roles.map(role => {
          const disabled = props.disabledRoles ? props.disabledRoles[role as string] : undefined
          if (disabled === null) {
            return null
          }
          const onSelect = disabled ? undefined : () => setSelectedRole(role)
          return (
            <RoleRowWrapper
              key={role as string}
              role={role}
              disabledReason={disabled}
              onSelect={onSelect}
              selected={selectedRole === role}
              plural={props.plural ?? false}
            />
          )
        })}
      </Kb.ScrollView>

      <Kb.Box2 fullWidth={true} direction="vertical" style={styles.footer}>
        {props.footerComponent}
        <Kb.ButtonBar direction="row" fullWidth={true} style={styles.footerButtonBar}>
          <Kb.Button
            fullWidth={true}
            disabled={!selectedRole || selectedRole === props.presetRole}
            waiting={props.waiting}
            label={selectedRole === 'setIndividually' ? 'Set Individually' : `Save`}
            onClick={
              selectedRole === props.presetRole || !selectedRole
                ? () => {}
                : () => props.onConfirm(selectedRole)
            }
          />
        </Kb.ButtonBar>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      abilityCheck: Styles.platformStyles({
        isElectron: {
          paddingRight: Styles.globalMargins.xtiny,
          paddingTop: 6,
        },
        isMobile: {paddingRight: Styles.globalMargins.tiny, paddingTop: 4},
      }),
      canText: {color: Styles.globalColors.black},
      checkIcon: {
        left: -24,
        paddingTop: 2,
        position: 'absolute',
      },
      checkbox: {
        ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
        flexGrow: 0,
      },
      container: Styles.platformStyles({
        common: {backgroundColor: Styles.globalColors.white},
        isElectron: {
          borderColor: Styles.globalColors.blue,
          borderRadius: Styles.borderRadius,
          borderStyle: 'solid',
          borderWidth: 1,
          boxShadow: `0 0 3px 0 rgba(0, 0, 0, 0.15), 0 0 5px 0 ${Styles.globalColors.black_20OrBlack}`,
          minHeight: 350,
          width: 310,
        },
        isMobile: {
          flex: 1,
        },
      }),
      disabledRow: {opacity: 0.4},
      footer: {
        flexGrow: 0,
        justifyContent: 'flex-end',
        paddingBottom: Styles.globalMargins.small,
        paddingTop: Styles.globalMargins.tiny,
      },
      footerButtonBar: {
        minHeight: undefined,
        paddingLeft: Styles.globalMargins.small,
        paddingRight: Styles.globalMargins.small,
      },
      header: {padding: Styles.globalMargins.xsmall},
      innerScroll: {
        flexGrow: 1,
        width: '100%',
      },
      opaqueContainer: Styles.platformStyles({
        isMobile: {
          backgroundColor: Styles.globalColors.white,
          paddingTop: 10,
        },
      }),
      radioButton: Styles.platformStyles({isMobile: {paddingRight: Styles.globalMargins.tiny}}),
      roleIcon: {paddingRight: Styles.globalMargins.xtiny},
      roleRow: Styles.platformStyles({common: {overflow: 'hidden'}, isMobile: {height: 56}}),
      row: {
        backgroundColor: Styles.globalColors.blueGreyLight,
        position: 'relative',
      },
      rowBody: Styles.platformStyles({
        // To push the body out of the zone visible when deselected
        common: {paddingTop: 6},
        // Width of the radio button. Used to align text with title
        isElectron: {paddingLeft: 22},
        isMobile: {paddingLeft: 38},
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
      rowPadding: Styles.platformStyles({
        isElectron: {paddingTop: Styles.globalMargins.xtiny},
      }),
      rowSelected: {
        position: 'relative',
      },
      scroll: {
        backgroundColor: Styles.globalColors.white,
      },
      text: {
        textAlign: 'left',
      },
    } as const)
)

// Helper to use this as a floating box
export type FloatingProps<T extends boolean> = {
  position?: Styles.Position
  children?: React.ReactNode
  floatingContainerStyle?: StylesCrossPlatform
  open: boolean
} & Props<T>

export class FloatingRolePicker<IncludeSetIndividually extends boolean = false> extends React.Component<
  FloatingProps<IncludeSetIndividually>,
  {ref: Kb.Box | null}
> {
  state = {ref: null}
  _returnRef = () => this.state.ref
  _setRef = (ref: Kb.Box | null) => this.setState({ref})
  render() {
    const {position, children, open, floatingContainerStyle, onCancel, ...props} = this.props
    const picker = (
      <RolePicker<IncludeSetIndividually> {...props} onCancel={Styles.isMobile ? undefined : onCancel} />
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
            <Kb.SafeAreaView>
              <Kb.Box2
                direction="vertical"
                fullHeight={Styles.isMobile}
                style={Styles.collapseStyles([floatingContainerStyle, styles.opaqueContainer])}
              >
                {Styles.isMobile && (
                  <Kb.HeaderHocHeader onLeftAction={onCancel} leftAction="cancel" title="Pick a role" />
                )}
                {picker}
              </Kb.Box2>
            </Kb.SafeAreaView>
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
// as because convincing TS that the last element of the array is a different type is hard
export const nextRoleDown = (currentRole: Role<false>): Role<false> =>
  orderedRoles[(orderedRoles.indexOf(currentRole) + 1) % (orderedRoles.length - 1)] as Role<false>
export const nextRoleUp = (currentRole: Role<false>): Role<false> =>
  orderedRoles[
    (orderedRoles.length + (orderedRoles.indexOf(currentRole) - 1)) % (orderedRoles.length - 1)
  ] as Role<false>

export const roleIconMap = {
  admin: 'iconfont-crown-admin',
  owner: 'iconfont-crown-owner',
  reader: undefined,
  writer: undefined,
} as const

export default RolePicker
