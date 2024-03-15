import * as React from 'react'
import * as Kb from '@/common-adapters'
import capitalize from 'lodash/capitalize'
import {pluralize} from '@/util/string'
import type * as T from '@/constants/types'

// Controls the ordering of the role picker
const orderedRoles: Array<Role<true>> = ['owner', 'admin', 'writer', 'reader', 'setIndividually']

// TODO include bot roles in here; this is short term to allow bots to show up in the gui
type BaseRole = Exclude<T.Teams.TeamRoleType, 'bot' | 'restrictedbot'>
type Role<IncludeSetIndividually> = IncludeSetIndividually extends true
  ? BaseRole | 'setIndividually'
  : BaseRole

type MaybeRole<IncludeSetIndividually> =
  | T.Teams.TeamRoleType
  | undefined
  | (IncludeSetIndividually extends true ? 'setIndividually' : undefined)

function filterRole<IncludeSetIndividually extends boolean>(
  r: MaybeRole<IncludeSetIndividually>
): Role<IncludeSetIndividually> | undefined {
  return r === 'bot' || r === 'restrictedbot' || !r
    ? undefined
    : (r as Role<IncludeSetIndividually> | undefined)
}

type DisabledReason = string | undefined // undefined means don't show it at all

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
  icon: React.ReactNode
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
        style={Kb.Styles.collapseStyles([
          p.disabledReason ? styles.disabledRow : undefined,
          styles.rowPadding,
        ])}
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
        style={Kb.Styles.collapseStyles([styles.rowBody])}
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

const RoleRowWrapper = (props: RoleRowWrapperProps) => {
  const {role, selected, onSelect, disabledReason, plural} = props
  const roleInfo = rolesMetaInfo(role)

  const style = {
    ...(Kb.Styles.isMobile ? {} : {height: selected ? 160 : 42}),
  }
  return (
    <Kb.ClickableBox onClick={onSelect} style={style}>
      <Kb.Divider />
      <RoleRow
        selected={selected}
        title={
          role === 'setIndividually'
            ? 'Set Individually'
            : pluralize(capitalize(role as string), plural ? 2 : 1)
        }
        body={
          selected
            ? [
                roleAbilities(roleInfo.cans, true, roleInfo.cants.length === 0),
                roleAbilities(roleInfo.cants, false, true),
              ]
            : null
        }
        icon={roleInfo.icon}
        onSelect={onSelect}
        disabledReason={disabledReason}
      />
    </Kb.ClickableBox>
  )
}

type RolesMetaInfo = {
  cans: Array<string>
  cants: Array<string>
  extra?: Array<string>
  icon: React.ReactNode
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
      style={{
        flexShrink: 0,
        ...(addFinalPadding && i === abilities.length - 1
          ? {paddingBottom: Kb.Styles.globalMargins.tiny}
          : undefined),
      }}
    >
      <Kb.Icon
        type={canDo ? 'iconfont-check' : 'iconfont-block'}
        sizeType="Tiny"
        style={Kb.Styles.isMobile ? styles.abilityCheck : undefined}
        boxStyle={!Kb.Styles.isMobile ? styles.abilityCheck : undefined}
        color={canDo ? Kb.Styles.globalColors.green : Kb.Styles.globalColors.black_50}
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
  const {presetRole} = props
  const filteredRole = filterRole(presetRole)
  const [selectedRole, setSelectedRole] = React.useState<Role<IncludeSetIndividually>>(
    filteredRole ?? ('reader' as Role<IncludeSetIndividually>)
  )
  React.useEffect(() => {
    const newRole = filterRole(presetRole) ?? ('reader' as Role<IncludeSetIndividually>)
    setSelectedRole(newRole)
  }, [presetRole])

  // as because convincing TS that filtering this makes it a different type is hard
  const roles = orderedRoles.filter(r => props.includeSetIndividually || r !== 'setIndividually') as Array<
    Role<IncludeSetIndividually>
  >
  return (
    <Kb.Box2
      direction="vertical"
      alignItems="stretch"
      style={styles.container}
      fullHeight={Kb.Styles.isMobile}
    >
      {!Kb.Styles.isMobile && <Header />}
      <Kb.ScrollView style={styles.innerScroll}>
        {roles.map(role => {
          const disabled = props.disabledRoles ? props.disabledRoles[role] : undefined
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
            disabled={selectedRole === presetRole}
            waiting={props.waiting}
            label={selectedRole === 'setIndividually' ? 'Set Individually' : `Save`}
            onClick={selectedRole === presetRole ? () => {} : () => props.onConfirm(selectedRole)}
          />
        </Kb.ButtonBar>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      abilityCheck: Kb.Styles.platformStyles({
        isElectron: {
          paddingRight: Kb.Styles.globalMargins.xtiny,
          paddingTop: 6,
        },
        isMobile: {paddingRight: Kb.Styles.globalMargins.tiny, paddingTop: 4},
      }),
      canText: {color: Kb.Styles.globalColors.black},
      checkIcon: {
        left: -24,
        paddingTop: 2,
        position: 'absolute',
      },
      checkbox: {
        ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.small),
        flexGrow: 0,
      },
      container: Kb.Styles.platformStyles({
        common: {backgroundColor: Kb.Styles.globalColors.white},
        isElectron: {
          borderColor: Kb.Styles.globalColors.blue,
          borderRadius: Kb.Styles.borderRadius,
          borderStyle: 'solid',
          borderWidth: 1,
          boxShadow: `0 0 3px 0 rgba(0, 0, 0, 0.15), 0 0 5px 0 ${Kb.Styles.globalColors.black_20OrBlack}`,
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
        paddingBottom: Kb.Styles.globalMargins.small,
        paddingTop: Kb.Styles.globalMargins.tiny,
      },
      footerButtonBar: {
        minHeight: undefined,
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingRight: Kb.Styles.globalMargins.small,
      },
      header: {padding: Kb.Styles.globalMargins.xsmall},
      innerScroll: {
        flexGrow: 1,
        width: '100%',
      },
      opaqueContainer: Kb.Styles.platformStyles({
        isMobile: {
          backgroundColor: Kb.Styles.globalColors.white,
          paddingTop: 10,
        },
      }),
      radioButton: Kb.Styles.platformStyles({isMobile: {paddingRight: Kb.Styles.globalMargins.tiny}}),
      roleIcon: {paddingRight: Kb.Styles.globalMargins.xtiny},
      row: {
        backgroundColor: Kb.Styles.globalColors.blueGreyLight,
        position: 'relative',
      },
      rowBody: Kb.Styles.platformStyles({
        // To push the body out of the zone visible when deselected
        common: {paddingTop: 6},
        // Width of the radio button. Used to align text with title
        isElectron: {paddingLeft: 22},
        isMobile: {paddingLeft: 38},
      }),
      rowChild: Kb.Styles.platformStyles({
        common: {
          paddingBottom: Kb.Styles.globalMargins.tiny,
          paddingLeft: Kb.Styles.globalMargins.small,
          paddingRight: Kb.Styles.globalMargins.small,
          paddingTop: Kb.Styles.globalMargins.tiny,
        },

        isMobile: {
          paddingBottom: Kb.Styles.globalMargins.small,
          paddingTop: Kb.Styles.globalMargins.small,
        },
      }),
      rowPadding: Kb.Styles.platformStyles({
        isElectron: {paddingTop: Kb.Styles.globalMargins.xtiny},
      }),
      rowSelected: {
        position: 'relative',
      },
      scroll: {
        backgroundColor: Kb.Styles.globalColors.white,
      },
      text: {
        textAlign: 'left',
      },
    }) as const
)

// Helper to use this as a floating box
export type FloatingProps<T extends boolean> = {
  position?: Kb.Styles.Position
  children?: React.ReactNode
  floatingContainerStyle?: Kb.Styles.StylesCrossPlatform
  open: boolean
} & Props<T>

export class FloatingRolePicker<IncludeSetIndividually extends boolean = false> extends React.Component<
  FloatingProps<IncludeSetIndividually>
> {
  popupAnchor = React.createRef<Kb.MeasureRef>()
  render() {
    const {position, children, open, floatingContainerStyle, onCancel, ...props} = this.props
    const picker = (
      <RolePicker<IncludeSetIndividually> {...props} onCancel={Kb.Styles.isMobile ? undefined : onCancel} />
    )
    return (
      <>
        {children}
        <Kb.Box2Measure direction="vertical" ref={this.popupAnchor} />
        {open && (
          <Kb.FloatingBox
            attachTo={this.popupAnchor}
            position={position || 'top center'}
            onHidden={onCancel}
            hideKeyboard={true}
          >
            <Kb.SafeAreaView>
              <Kb.Box2
                direction="vertical"
                fullHeight={Kb.Styles.isMobile}
                style={Kb.Styles.collapseStyles([floatingContainerStyle, styles.opaqueContainer])}
              >
                {Kb.Styles.isMobile && (
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
