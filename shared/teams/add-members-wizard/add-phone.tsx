import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/teams'
import * as SettingsGen from '../../actions/settings-gen'
import {ModalTitle} from '../common'

type Props = Container.RouteProps<{
  teamID: Types.TeamID
}>

const AddPhone = (props: Props) => {
  const [phoneNumbers, setPhoneNumbers] = React.useState([{key: 0, phoneNumber: '', valid: false}])
  const teamID = Container.getRouteProps(props, 'teamID', Types.noTeamID)

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onBack = () => dispatch(nav.safeNavigateUpPayload())

  const disabled = !phoneNumbers.length || phoneNumbers.some(pn => !pn.valid)
  const setPhoneNumber = (i: number, phoneNumber: string, valid: boolean) => {
    const pn = phoneNumbers[i]
    if (pn) {
      pn.phoneNumber = phoneNumber
      pn.valid = valid
      setPhoneNumbers([...phoneNumbers])
    }
  }

  const addPhoneNumber = () => {
    phoneNumbers.push({key: phoneNumbers[phoneNumbers.length - 1].key + 1, phoneNumber: '', valid: false})
    setPhoneNumbers([...phoneNumbers])
  }
  const removePhoneNumber = (i: number) => {
    phoneNumbers.splice(i, 1)
    setPhoneNumbers([...phoneNumbers])
  }

  const teamname = Container.useSelector(s => Constants.getTeamMeta(s, teamID).teamname)
  const defaultCountry = Container.useSelector(s => s.settings.phoneNumbers.defaultCountry)

  React.useEffect(() => {
    if (!defaultCountry) {
      dispatch(SettingsGen.createLoadDefaultPhoneNumberCountry())
    }
  }, [defaultCountry, dispatch])

  return (
    <Kb.Modal
      mode="DefaultFullHeight"
      onClose={onBack}
      header={{
        leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />,
        title: <ModalTitle teamname={teamname} title="Phone list" />,
      }}
      allowOverflow={true}
      footer={{
        content: (
          <Kb.Button
            fullWidth={true}
            label="Continue"
            onClick={() => undefined} //TODO: Implement this
            disabled={disabled}
          />
        ),
      }}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.body} gap="tiny">
        <Kb.Text type="Body">Enter one or multiple phone numbers:</Kb.Text>
        <Kb.Box2 direction="vertical" gap="xsmall" fullWidth={true} alignItems="flex-start">
          {phoneNumbers.map((pn, idx) => (
            <Kb.PhoneInput
              key={pn.key}
              autoFocus={idx === 0}
              defaultCountry={defaultCountry}
              onChangeNumber={(phoneNumber, valid) => setPhoneNumber(idx, phoneNumber, valid)}
              onClear={phoneNumbers.length === 1 ? undefined : () => removePhoneNumber(idx)}
            />
          ))}
          <Kb.Button mode="Secondary" icon="iconfont-new" onClick={addPhoneNumber} />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  body: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.small),
      ...Styles.globalStyles.flexOne,
      backgroundColor: Styles.globalColors.blueGrey,
    },
    isMobile: {...Styles.globalStyles.flexOne},
  }),
  container: {
    padding: Styles.globalMargins.small,
  },
  wordBreak: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
}))

export default AddPhone
