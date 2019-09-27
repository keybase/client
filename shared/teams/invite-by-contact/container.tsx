import * as Constants from '../../constants/teams'
import * as Contacts from 'expo-contacts'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters/mobile.native'
import * as React from 'react'
import * as SettingsConstants from '../../constants/settings'
import * as SettingsGen from '../../actions/settings-gen'
import * as Styles from '../../styles'
import {e164ToDisplay} from '../../util/phone-numbers'
import {FloatingRolePicker} from '../role-picker'
import {pluralize} from '../../util/string'
import {TeamRoleType} from '../../constants/types/teams'
import logger from '../../logger'

type OwnProps = Container.RouteProps<{teamname: string}>

type ContactProps = {
  name: string
  pictureUri?: string
  type: 'phone' | 'email'
  value: string
  valueFormatted?: string
}

const fetchContacts = async () => {
  const contacts = await Contacts.getContactsAsync({
    fields: [
      Contacts.Fields.Name,
      Contacts.Fields.PhoneNumbers,
      Contacts.Fields.Emails,
      Contacts.Fields.ImageAvailable,
      Contacts.Fields.Image,
    ],
  })

  let defaultCountryCode: string = ''
  try {
    defaultCountryCode = await NativeModules.Utils.getDefaultCountryCode()
    if (__DEV__ && !defaultCountryCode) {
      // behavior of parsing can be unexpectedly different with no country code.
      // iOS sim + android emu don't supply country codes, so use this one.
      defaultCountryCode = 'us'
    }
  } catch (e) {
    logger.warn(`Error loading default country code: ${e.message}`)
  }

  const mapped = contacts.data.reduce<Array<ContactProps>>((ret, contact) => {
    const {name, phoneNumbers = [], emails = []} = contact
    let pictureUri: string | undefined
    console.log('zzz', contact)
    if (contact.imageAvailable && contact.image && contact.image.uri) {
      pictureUri = contact.image.uri
    }
    phoneNumbers.forEach(pn => {
      if (pn.number) {
        const value = SettingsConstants.getE164(pn.number, pn.countryCode || defaultCountryCode)
        if (value) {
          const valueFormatted = e164ToDisplay(value)
          ret.push({name, pictureUri, type: 'phone', value, valueFormatted})
        }
      }
    })
    emails.forEach(em => {
      if (em.email) {
        ret.push({name, pictureUri, type: 'email', value: em.email})
      }
    })
    return ret
  }, [])
  const strcmp = (a, b) => (a === b ? 0 : a > b ? 1 : -1)
  mapped.sort((a, b) => strcmp(a.name, b.name))
  return mapped
}

const contactRow = (_: number, props: ContactProps) => {
  const hasThumbnail = !!props.pictureUri
  const source = props.pictureUri ? {uri: props.pictureUri} : null

  return (
    <Kb.Box
      style={{
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        height: 56,
        padding: Styles.globalMargins.small,
        width: '100%',
      }}
    >
      <Kb.Box style={{...Styles.globalStyles.flexBoxRow, alignItems: 'center', flex: 1}}>
        <Kb.Box style={{...Styles.globalStyles.flexBoxRow, alignItems: 'center', flex: 1}}>
          {!!hasThumbnail && !!source && (
            <Kb.NativeImage
              style={{borderRadius: 24, height: 48, marginRight: 16, width: 48}}
              source={source}
            />
          )}
          {!hasThumbnail && <Kb.Avatar size={48} style={{marginRight: 16}} />}
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
            mode={props.selected ? 'Secondary' : 'Primary'}
            label={props.selected ? 'Invited!' : 'Invite'}
            waiting={props.loading}
            small={true}
            onClick={props.onClick}
            style={{
              paddingLeft: Styles.globalMargins.small,
              paddingRight: Styles.globalMargins.small,
              width: 100,
            }}
          />
        </Kb.Box>
      </Kb.Box>
    </Kb.Box>
  )
}

const TeamInviteByContact = (props: OwnProps) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const teamname = Container.getRouteProps(props, 'teamname', '')

  const [contacts, setContacts] = React.useState([] as Array<ContactProps>)
  const [hasError, setHasError] = React.useState(false)
  const [isRolePickerOpen, setIsRolePickerOpen] = React.useState(false)
  const [selectedRole, setSelectedRole] = React.useState('writer' as TeamRoleType)
  const [filter, setFilter] = React.useState('')

  const permStatus = Container.useSelector(s => s.settings.contacts.permissionStatus)
  const teamInvites = Container.useSelector(s => Constants.getTeamInvites(s, teamname))

  React.useEffect(() => {
    if (permStatus === 'granted') {
      fetchContacts().then(
        val => {
          setContacts(val)
          console.log('zzz', val)
        },
        err => {
          logger.warn('Error fetching contaxts:', err)
          setHasError(true)
        }
      )
    } else if (permStatus === 'unknown' || permStatus === 'undetermined') {
      dispatch(SettingsGen.createRequestContactPermissions({thenToggleImportOn: false}))
    }
  }, [dispatch, permStatus])

  const onBack = React.useCallback(() => dispatch(nav.safeNavigateUpPayload()), [dispatch, nav])
  const controlRolePicker = React.useCallback(
    (open: boolean) => {
      setIsRolePickerOpen(open)
    },
    [setIsRolePickerOpen]
  )
  const onRoleChange = React.useCallback(
    (role: TeamRoleType) => {
      setSelectedRole(role)
    },
    [setSelectedRole]
  )

  return (
    <Kb.Box
      style={{...Styles.globalStyles.flexBoxColumn, flex: 1, paddingBottom: Styles.globalMargins.xtiny}}
    >
      <FloatingRolePicker
        confirmLabel={`Invite as ${pluralize(selectedRole)}`}
        selectedRole={selectedRole}
        onSelectRole={onRoleChange}
        onConfirm={() => controlRolePicker(false)}
        open={isRolePickerOpen}
        position="bottom center"
        disabledRoles={{owner: 'Cannot invite an owner via email.'}}
      />
      <Kb.List
        keyProperty="id"
        items={contacts.map(x => ({...x, selected: false, loading: false}))}
        fixedHeight={56}
        ListHeaderComponent={
          <Kb.ClickableBox
            onClick={() => controlRolePicker(true)}
            style={{
              ...Styles.globalStyles.flexBoxColumn,
              alignItems: 'center',
              borderBottomColor: Styles.globalColors.black_10,
              borderBottomWidth: Styles.hairlineWidth,
              justifyContent: 'center',
              marginBottom: Styles.globalMargins.xtiny,
              padding: Styles.globalMargins.small,
            }}
          >
            <Kb.Text center={true} type="BodySmall">
              Users will be invited to {teamname} as
              <Kb.Text type="BodySmallPrimaryLink">{' ' + selectedRole + 's'}</Kb.Text>.
            </Kb.Text>
          </Kb.ClickableBox>
        }
        renderItem={contactRow}
        style={{alignSelf: 'stretch'}}
      />
    </Kb.Box>
  )
}

export default TeamInviteByContact
