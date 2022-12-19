import * as Kb from '../../common-adapters/mobile.native'
import * as React from 'react'
import * as Styles from '../../styles'
import {FloatingRolePicker} from '../role-picker'
import type {TeamRoleType} from '../../constants/types/teams'
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
  const source = props.pictureUri ? {uri: props.pictureUri} : null

  return (
    <Kb.Box style={styles.contactRowBox}>
      <Kb.Box style={styles.contactRowInnerBox}>
        <Kb.Box style={styles.contactRowInnerBox}>
          {!!hasThumbnail && !!source && <Kb.NativeImage style={styles.thumbnail} source={source} />}
          {!hasThumbnail && <Kb.Avatar size={48} style={styles.placeHolderAvatar} />}
          <Kb.Box>
            <Kb.Box style={Styles.globalStyles.flexBoxRow}>
              <Kb.Text type="BodySemibold">{props.name}</Kb.Text>
            </Kb.Box>
            <Kb.Box style={Styles.globalStyles.flexBoxRow}>
              <Kb.Text type="BodySmall">{props.valueFormatted || props.value}</Kb.Text>
            </Kb.Box>
          </Kb.Box>
        </Kb.Box>
        <Kb.Box>
          <Kb.Button
            type="Success"
            mode={props.alreadyInvited ? 'Secondary' : 'Primary'}
            label={props.alreadyInvited ? 'Invited!' : 'Invite'}
            waiting={props.loading}
            small={true}
            onClick={props.onClick}
            style={styles.inviteButton}
          />
        </Kb.Box>
      </Kb.Box>
    </Kb.Box>
  )
}

export type InviteByContactProps = {
  onBack: () => void
  selectedRole: TeamRoleType
  onRoleChange: (newRole: TeamRoleType) => void
  teamName: string
  listItems: Array<ContactRowProps>
  errorMessage: string | null
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
      [row.name, row.value, row.valueFormatted].some(
        s =>
          s &&
          s
            .replace(/^[^a-z0-9@._+()]/i, '')
            .toLowerCase()
            .includes(filterValue.toLowerCase())
      )
    )
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.HeaderHocHeader onBack={props.onBack} title="Invite contacts" />
      {!!props.errorMessage && (
        <Kb.Box2 direction="horizontal" style={styles.errorMessageContainer} fullWidth={true}>
          <Kb.Text center={true} type="BodySemibold" negative={true}>
            {props.errorMessage}
          </Kb.Text>
        </Kb.Box2>
      )}
      {hasItems && (
        <Kb.Box style={styles.listContainer}>
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
          <Kb.List
            keyProperty="id"
            items={listItems}
            fixedHeight={56}
            ListHeaderComponent={
              <Kb.ClickableBox onClick={() => controlRolePicker(true)} style={styles.rolePickerBox}>
                <Kb.Text center={true} type="BodySmall">
                  Users will be invited to {props.teamName} as
                  <Kb.Text type="BodySmallPrimaryLink">{' ' + props.selectedRole + 's'}</Kb.Text>.
                </Kb.Text>
              </Kb.ClickableBox>
            }
            renderItem={contactRow}
            style={styles.contactList}
          />
        </Kb.Box>
      )}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      contactList: {
        alignSelf: 'stretch',
      },
      contactRowBox: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        height: 56,
        padding: Styles.globalMargins.small,
        width: '100%',
      },
      contactRowInnerBox: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        flex: 1,
      },
      errorMessageContainer: {
        alignItems: 'center',
        backgroundColor: Styles.globalColors.red,
        justifyContent: 'center',
        padding: Styles.globalMargins.tiny,
      },
      filter: {
        width: '100%',
      },
      filterContainer: {
        borderBottomColor: Styles.globalColors.black_10,
        borderBottomWidth: Styles.hairlineWidth,
        padding: Styles.globalMargins.small,
      },
      inviteButton: {
        paddingLeft: Styles.globalMargins.small,
        paddingRight: Styles.globalMargins.small,
        width: 100,
      },
      listContainer: {
        ...Styles.globalStyles.flexBoxColumn,
        flex: 1,
        paddingBottom: Styles.globalMargins.xtiny,
      },
      placeHolderAvatar: {
        marginRight: 16,
      },
      rolePickerBox: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        borderBottomColor: Styles.globalColors.black_10,
        borderBottomWidth: Styles.hairlineWidth,
        justifyContent: 'center',
        marginBottom: Styles.globalMargins.xtiny,
        padding: Styles.globalMargins.small,
      },
      thumbnail: {
        borderRadius: 24,
        height: 48,
        marginRight: 16,
        width: 48,
      },
    } as const)
)
