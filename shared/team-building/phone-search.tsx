import * as C from '@/constants'
import * as TB from '@/stores/team-building'
import * as React from 'react'
import * as Kb from '@/common-adapters/index'
import type * as T from '@/constants/types'
import ContinueButton from './continue-button'
import {useSettingsPhoneState} from '@/stores/settings-phone'
import {searchWaitingKey} from '@/constants/strings'

type PhoneSearchProps = {
  continueLabel: string
  namespace: T.TB.AllowedNamespace
  search: (query: string, service: 'phone') => void
}

const PhoneSearch = (props: PhoneSearchProps) => {
  const {namespace} = props
  const teamBuildingSearchResults = TB.useTBContext(s => s.searchResults)
  const [isPhoneValid, setPhoneValidity] = React.useState(false)
  const [phoneNumber, setPhoneNumber] = React.useState('')
  const [phoneInputKey, setPhoneInputKey] = React.useState(0)
  const waiting = C.Waiting.useAnyWaiting(searchWaitingKey)
  const loadDefaultPhoneCountry = useSettingsPhoneState(s => s.dispatch.loadDefaultPhoneCountry)
  // trigger a default phone number country rpc if it's not already loaded
  const defaultCountry = useSettingsPhoneState(s => s.defaultCountry)
  React.useEffect(() => {
    !defaultCountry && loadDefaultPhoneCountry()
  }, [defaultCountry, loadDefaultPhoneCountry])

  const onChangeNumberCb = (phoneNumber: string, validity: boolean) => {
    setPhoneValidity(validity)
    setPhoneNumber(phoneNumber)
    if (validity) {
      props.search(phoneNumber, 'phone')
    }
  }

  const addUsersToTeamSoFar = TB.useTBContext(s => s.dispatch.addUsersToTeamSoFar)

  const user: T.TB.User | undefined = isPhoneValid
    ? teamBuildingSearchResults.get(phoneNumber)?.get('phone')?.[0]
    : undefined

  const canSubmit = !!user && !waiting && isPhoneValid

  const _onContinue = React.useCallback(() => {
    if (!canSubmit) {
      return
    }
    addUsersToTeamSoFar([user])
    // Clear input
    setPhoneNumber('')
    setPhoneInputKey(old => old + 1)
    setPhoneValidity(false)
  }, [addUsersToTeamSoFar, user, setPhoneNumber, canSubmit, setPhoneInputKey, setPhoneValidity])

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
              centerChildren={!Kb.Styles.isMobile}
              direction="vertical"
              fullWidth={true}
              gap="tiny"
              style={styles.emptyContainer}
            >
              {!Kb.Styles.isMobile && (
                <Kb.Icon color={Kb.Styles.globalColors.black_20} fontSize={48} type="iconfont-number-pad" />
              )}
              {namespace === 'chat2' ? (
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
    <Kb.Icon type="iconfont-check" sizeType="Tiny" color={Kb.Styles.globalColors.greenDark} />
    <Kb.Text type="BodySmall">
      {"Great! That's "}
      <Kb.ConnectedUsernames
        colorFollowing={true}
        inline={true}
        onUsernameClicked="profile"
        type="BodySmallBold"
        usernames={username}
      />
      {' on Keybase.'}
    </Kb.Text>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      button: {flexGrow: 0},
      containerStyle: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.blueGrey,
          flex: 1,
          padding: Kb.Styles.globalMargins.small,
        },
        isMobile: {
          zIndex: -1,
        },
      }),
      emptyContainer: Kb.Styles.platformStyles({
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
      helperText: Kb.Styles.platformStyles({
        common: {textAlign: 'center'},
        isMobile: {
          paddingBottom: Kb.Styles.globalMargins.small,
          paddingTop: Kb.Styles.globalMargins.small,
        },
      }),
      loading: {alignSelf: 'center'},
      userMatchMention: {
        alignSelf: 'flex-start',
        justifyContent: 'center',
      },
    }) as const
)

export default PhoneSearch
