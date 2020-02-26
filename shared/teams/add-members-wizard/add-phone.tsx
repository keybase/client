import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/teams'
import {ModalTitle} from '../common'
import PhoneInput from '../../signup/phone-number/phone-input'

type Props = {
  teamID: Types.TeamID
}

const AddPhone = (props: Props) => {
  const [invitees, setInvitees] = React.useState('')

  // const dispatch = Container.useDispatch()
  // const nav = Container.useSafeNavigation()
  const onBack = () => null // dispatch(nav.safeNavigateUpPayload())

  const disabled = invitees.length < 1

  const teamname = Container.useSelector(s => Constants.getTeamMeta(s, props.teamID).teamname)
  const defaultCountry = Container.useSelector(s => s.settings.phoneNumbers.defaultCountry)

  return (
    <Kb.Modal
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
        <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} alignItems="flex-start">
          <PhoneInput defaultCountry={defaultCountry} />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  body: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.small),
      backgroundColor: Styles.globalColors.blueGrey,
      borderRadius: 4,
    },
    isElectron: {minHeight: 326},
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
