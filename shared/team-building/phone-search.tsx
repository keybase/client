import * as React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'
import * as Constants from '../constants/team-building'
import * as Container from '../util/container'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as SettingsGen from '../actions/settings-gen'
import * as Types from 'constants/types/team-building'
import {AllowedNamespace} from '../constants/types/team-building'
import ContinueButton from './continue-button'

type PhoneSearchProps = {
  continueLabel: string
  namespace: AllowedNamespace
  search: (query: string, service: 'phone') => void
  teamBuildingSearchResults: Types.SearchResults
}

const PhoneSearch = (props: PhoneSearchProps) => {
  const {namespace} = props
  const [isPhoneValid, setPhoneValidity] = React.useState(false)
  const [phoneNumber, setPhoneNumber] = React.useState('')
  const [phoneInputKey, setPhoneInputKey] = React.useState(0)
  const waiting = Container.useAnyWaiting(Constants.searchWaitingKey)
  const dispatch = Container.useDispatch()

  // trigger a default phone number country rpc if it's not already loaded
  const defaultCountry = Container.useSelector(state => state.settings.phoneNumbers.defaultCountry)
  React.useEffect(() => {
    !defaultCountry && dispatch(SettingsGen.createLoadDefaultPhoneNumberCountry())
  }, [defaultCountry, dispatch])

  const onChangeNumberCb = (phoneNumber: string, validity: boolean) => {
    setPhoneValidity(validity)
    setPhoneNumber(phoneNumber)
    if (validity) {
      props.search(phoneNumber, 'phone')
    }
  }

  const user: Types.User | undefined = isPhoneValid
    ? props.teamBuildingSearchResults.get(phoneNumber)?.get('phone')?.[0]
    : undefined

  const canSubmit = !!user && !waiting && isPhoneValid

  const _onContinue = React.useCallback(() => {
    if (!canSubmit || !user) {
      return
    }
    dispatch(TeamBuildingGen.createAddUsersToTeamSoFar({namespace, users: [user]}))
    // Clear input
    setPhoneNumber('')
    setPhoneInputKey(old => old + 1)
    setPhoneValidity(false)
  }, [dispatch, namespace, user, setPhoneNumber, canSubmit, setPhoneInputKey, setPhoneValidity])

  return (
    <>
      <Kb.Box2 direction="vertical" gap="tiny" style={styles.containerStyle} fullWidth={true}>
        <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true}>
          <Kb.PhoneInput
            // Supply a key to force reset the PhoneInput state after a user is added
            key={phoneInputKey}
            autoFocus={true}
            defaultCountry={defaultCountry}
            onChangeNumber={onChangeNumberCb}
            onEnterKeyDown={_onContinue}
          />
          {!!user && canSubmit && !!user.serviceMap.keybase ? (
            <UserMatchMention username={user.serviceMap.keybase} />
          ) : (
            <Kb.Text type="BodySmall" style={styles.helperText}>
              Start a chat with any phone number. Your messages will unlock after your recipient signs up and
              proves their phone number.
            </Kb.Text>
          )}
          {waiting && <Kb.ProgressIndicator type="Small" style={styles.loading} />}
        </Kb.Box2>
        <Kb.Box style={styles.spaceFillingBox} />
        <ContinueButton label={props.continueLabel} onClick={_onContinue} disabled={!canSubmit} />
      </Kb.Box2>
    </>
  )
}

type UserMatchMentionProps = {
  username: string
}
export const UserMatchMention = ({username}: UserMatchMentionProps) => (
  <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.userMatchMention} centerChildren={true}>
    <Kb.Icon type="iconfont-check" sizeType="Tiny" color={Styles.globalColors.greenDark} />
    <Kb.Text type="BodySmall">
      Great! That's{' '}
      <Kb.ConnectedUsernames
        colorFollowing={true}
        inline={true}
        onUsernameClicked="profile"
        type="BodySmallBold"
        usernames={username}
      />{' '}
      on Keybase.
    </Kb.Text>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      button: {flexGrow: 0},
      containerStyle: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.blueGrey,
          flex: 1,
          padding: Styles.globalMargins.small,
        },
        isMobile: {
          zIndex: -1,
        },
      }),
      helperText: {
        marginBottom: Styles.globalMargins.small,
        marginTop: Styles.globalMargins.small,
        textAlign: 'center',
      },
      loading: {alignSelf: 'center'},
      spaceFillingBox: {flexGrow: 1},
      userMatchMention: {
        alignSelf: 'flex-start',
        justifyContent: 'center',
      },
    } as const)
)

export default PhoneSearch
