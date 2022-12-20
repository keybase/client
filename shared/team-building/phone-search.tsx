import * as React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'
import * as Constants from '../constants/team-building'
import * as Container from '../util/container'
import * as TeamBuildingGen from '../actions/team-building-gen'
import * as SettingsGen from '../actions/settings-gen'
import type * as Types from 'constants/types/team-building'
import type {AllowedNamespace} from '../constants/types/team-building'
import ContinueButton from './continue-button'

type PhoneSearchProps = {
  continueLabel: string
  namespace: AllowedNamespace
  search: (query: string, service: 'phone') => void
}

const PhoneSearch = (props: PhoneSearchProps) => {
  const {namespace} = props
  const teamBuildingSearchResults = Container.useSelector(
    state => state[namespace].teamBuilding.searchResults
  )
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
    ? teamBuildingSearchResults.get(phoneNumber)?.get('phone')?.[0]
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
        <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true} style={styles.flexGrow}>
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
            <Kb.Box2
              alignSelf="center"
              centerChildren={!Styles.isMobile}
              direction="vertical"
              fullWidth={true}
              gap="tiny"
              style={styles.emptyContainer}
            >
              {!Styles.isMobile && (
                <Kb.Icon color={Styles.globalColors.black_20} fontSize={48} type="iconfont-number-pad" />
              )}

              {namespace == 'chat2' ? (
                <Kb.Text type="BodySmall" style={styles.helperText}>
                  Start a chat with any phone contact, then tell them to install Keybase. Your messages will
                  unlock after they sign up.
                </Kb.Text>
              ) : (
                <Kb.Text type="BodySmall" style={styles.helperText}>
                  Add any phone contact, then tell them to install Keybase. They will automatically join the
                  team after they sign up.
                </Kb.Text>
              )}
            </Kb.Box2>
          )}
          {waiting && <Kb.ProgressIndicator type="Small" style={styles.loading} />}
        </Kb.Box2>
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
      emptyContainer: Styles.platformStyles({
        common: {flex: 1},
        isElectron: {
          maxWidth: 290,
          paddingBottom: 40,
        },
        isMobile: {maxWidth: '90%'},
      }),
      flexGrow: {
        flex: 1,
      },
      helperText: Styles.platformStyles({
        common: {textAlign: 'center'},
        isMobile: {
          paddingBottom: Styles.globalMargins.small,
          paddingTop: Styles.globalMargins.small,
        },
      }),
      loading: {alignSelf: 'center'},
      userMatchMention: {
        alignSelf: 'flex-start',
        justifyContent: 'center',
      },
    } as const)
)

export default PhoneSearch
