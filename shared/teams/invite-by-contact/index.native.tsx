import * as Kb from '@/common-adapters'
import * as React from 'react'
import {FloatingRolePicker} from '../role-picker'
import type * as T from '@/constants/types'
import type {Contact} from '../common/use-contacts.native'

// Contact info + other things needed for list row.
export type ContactRowProps = Contact & {
  id: string
  alreadyInvited: boolean
  loading: boolean
  onClick: () => void
}

const contactRow = (_: number, props: ContactRowProps) => {
  const hasThumbnail = !!props.pictureUri

  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.contactRowBox}>
      <Kb.Box2 direction="horizontal" alignItems="center" flex={1}>
        <Kb.Box2 direction="horizontal" alignItems="center" flex={1}>
          {!!hasThumbnail && !!props.pictureUri && (
            <Kb.Image style={styles.thumbnail} src={props.pictureUri} />
          )}
          {!hasThumbnail && <Kb.Avatar size={48} style={styles.placeHolderAvatar} />}
          <Kb.Box2 direction="vertical">
            <Kb.Box2 direction="horizontal" fullWidth={true}>
              <Kb.Text type="BodySemibold">{props.name}</Kb.Text>
            </Kb.Box2>
            <Kb.Box2 direction="horizontal" fullWidth={true}>
              <Kb.Text type="BodySmall">{props.valueFormatted || props.value}</Kb.Text>
            </Kb.Box2>
          </Kb.Box2>
        </Kb.Box2>
        <Kb.Box2 direction="vertical">
          <Kb.Button
            type="Success"
            mode={props.alreadyInvited ? 'Secondary' : 'Primary'}
            label={props.alreadyInvited ? 'Invited!' : 'Invite'}
            waiting={props.loading}
            small={true}
            onClick={props.onClick}
            style={styles.inviteButton}
          />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

export type InviteByContactProps = {
  onBack: () => void
  selectedRole: T.Teams.TeamRoleType
  onRoleChange: (newRole: T.Teams.TeamRoleType) => void
  teamName: string
  listItems: Array<ContactRowProps>
  errorMessage?: string
}

export const InviteByContact = (props: InviteByContactProps) => {
  const [isRolePickerOpen, setRolePickerOpen] = React.useState(false)
  const controlRolePicker = React.useCallback(
    (open: boolean) => {
      setRolePickerOpen(open)
    },
    [setRolePickerOpen]
  )

  const [filterValue, setFilterValue] = React.useState('')
  const onFilterChange = React.useCallback(
    (newValue: string) => {
      setFilterValue(newValue)
    },
    [setFilterValue]
  )

  let {listItems} = props
  // Remember if we have any data before appying filtering.
  const hasItems = listItems.length > 0
  if (filterValue) {
    listItems = listItems.filter(row =>
      [row.name, row.value, row.valueFormatted].some(s =>
        s
          ?.replace(/^[^a-z0-9@._+()]/i, '')
          .toLowerCase()
          .includes(filterValue.toLowerCase())
      )
    )
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.HeaderHocHeader onBack={props.onBack} title="Invite contacts" />
      {!!props.errorMessage && (
        <Kb.Box2 direction="horizontal" style={styles.errorMessageContainer} fullWidth={true} justifyContent="center">
          <Kb.Text center={true} type="BodySemibold" negative={true}>
            {props.errorMessage}
          </Kb.Text>
        </Kb.Box2>
      )}
      {hasItems && (
        <Kb.Box2 direction="vertical" fullWidth={true} flex={1} style={styles.listContainer}>
          <Kb.Box2 direction="horizontal" style={styles.filterContainer}>
            <Kb.PlainInput
              autoFocus={true}
              keyboardType="email-address"
              value={filterValue}
              onChangeText={onFilterChange}
              placeholder="Search"
              style={styles.filter}
            />
          </Kb.Box2>
          <FloatingRolePicker
            presetRole={props.selectedRole}
            onConfirm={role => {
              props.onRoleChange(role)
              controlRolePicker(false)
            }}
            open={isRolePickerOpen}
            position="bottom center"
            disabledRoles={{owner: 'Cannot invite an owner via email.'}}
          />
          <Kb.ClickableBox onClick={() => controlRolePicker(true)} style={styles.rolePickerBox}>
            <Kb.Text center={true} type="BodySmall">
              Users will be invited to {props.teamName} as
              <Kb.Text type="BodySmallPrimaryLink">{' ' + props.selectedRole + 's'}</Kb.Text>.
            </Kb.Text>
          </Kb.ClickableBox>
          <Kb.List
            keyProperty="id"
            items={listItems}
            itemHeight={{height: 56, type: 'fixed'}}
            renderItem={contactRow}
            style={styles.contactList}
          />
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      contactList: {
        alignSelf: 'stretch',
      },
      contactRowBox: {
        height: 56,
        padding: Kb.Styles.globalMargins.small,
      },
      errorMessageContainer: {
        alignItems: 'center',
        backgroundColor: Kb.Styles.globalColors.red,
        padding: Kb.Styles.globalMargins.tiny,
      },
      filter: {
        width: '100%',
      },
      filterContainer: {
        borderBottomColor: Kb.Styles.globalColors.black_10,
        borderBottomWidth: Kb.Styles.hairlineWidth,
        padding: Kb.Styles.globalMargins.small,
      },
      inviteButton: {
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingRight: Kb.Styles.globalMargins.small,
        width: 100,
      },
      listContainer: {
        paddingBottom: Kb.Styles.globalMargins.xtiny,
      },
      placeHolderAvatar: {
        marginRight: 16,
      },
      rolePickerBox: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        borderBottomColor: Kb.Styles.globalColors.black_10,
        borderBottomWidth: Kb.Styles.hairlineWidth,
        justifyContent: 'center',
        marginBottom: Kb.Styles.globalMargins.xtiny,
        padding: Kb.Styles.globalMargins.small,
      },
      thumbnail: {
        borderRadius: 24,
        height: 48,
        marginRight: 16,
        width: 48,
      },
    }) as const
)
