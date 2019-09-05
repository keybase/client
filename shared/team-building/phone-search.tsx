import * as React from 'react'
import * as Kb from '../common-adapters/index'
import PhoneInput from '../signup/phone-number/phone-input'
import * as Styles from '../styles'
import {ServiceIdWithContact, User} from 'constants/types/team-building'
import ContinueButton from './continue-button'

type PhoneSearchProps = {
  onContinue: (user: User) => void
  search: (query: string, service: ServiceIdWithContact) => void
  teamBuildingSearchResults: {[query: string]: {[service in ServiceIdWithContact]: Array<User>}}
}

type CurrentState = 'resolved' | 'loading' | 'notfound' | 'none'

const PhoneSearch = (props: PhoneSearchProps) => {
  const {onContinue} = props
  const [validity, setValidity] = React.useState<boolean>(false)
  const [phoneNumber, setPhoneNumber] = React.useState<string>('')
  const [phoneInputKey, setPhoneInputKey] = React.useState<number>(0)

  const onChangeNumberCb = (phoneNumber: string, validity: boolean) => {
    setValidity(validity)
    setPhoneNumber(phoneNumber)
    if (validity) {
      // TODO: Is this okay to reuse the 'keybase' service name? Or should we add a 'phone' one to iced?
      props.search(phoneNumber, 'keybase')
    }
  }

  let state: CurrentState = 'none'
  let user: User | null = null
  if (
    validity &&
    props.teamBuildingSearchResults &&
    props.teamBuildingSearchResults[phoneNumber] &&
    props.teamBuildingSearchResults[phoneNumber].keybase &&
    props.teamBuildingSearchResults[phoneNumber].keybase[0]
  ) {
    let serviceMap = props.teamBuildingSearchResults[phoneNumber].keybase[0].serviceMap
    let username = props.teamBuildingSearchResults[phoneNumber].keybase[0].serviceMap.keybase
    let prettyName = props.teamBuildingSearchResults[phoneNumber].keybase[0].prettyName
    if (serviceMap && username && prettyName) {
      user = {
        id: username,
        prettyName,
        serviceId: 'keybase',
        serviceMap,
        username,
      }
      state = 'resolved'
    }
  }
  if (state === 'none' && validity && props.teamBuildingSearchResults[phoneNumber] === undefined) {
    state = 'loading'
  }
  if (state === 'none' && validity && props.teamBuildingSearchResults[phoneNumber] !== undefined) {
    state = 'notfound'
  }

  let _onContinue = React.useCallback(() => {
    if (!validity) {
      return
    }
    if (user) {
      onContinue(user)
    } else {
      // Continue in order to start a conversation with their phone number
      onContinue({
        // substr to chop off the '+' at the start so it is in the correct format for an assertion
        id: phoneNumber.substr(1) + '@phone',
        prettyName: phoneNumber,
        serviceId: 'phone',
        serviceMap: {},
        username: phoneNumber,
      })
    }
    setPhoneNumber('')
    setPhoneInputKey(old => old + 1)
    setValidity(false)
  }, [user, phoneNumber, setPhoneNumber, setValidity, setPhoneInputKey, onContinue])

  return (
    <>
      <Kb.Box2 direction="vertical" gap="tiny" style={styles.containerStyle}>
        <Kb.Box2 direction="vertical" gap="tiny">
          <PhoneInput
            // Supply a key to force reset the PhoneInput state after a user is added
            key={phoneInputKey}
            autoFocus={true}
            onChangeNumber={onChangeNumberCb}
            onEnterKeyDown={_onContinue}
          />
          {state === 'resolved' && !!user && (
            <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.userMatchMention} centerChildren={true}>
              <Kb.Icon type="iconfont-check" sizeType="Tiny" color={Styles.globalColors.greenDark} />
              <Kb.Text type="BodySmall">
                Great! That's{' '}
                <Kb.ConnectedUsernames
                  colorFollowing={true}
                  inline={true}
                  type="BodySmallSemibold"
                  usernames={[user.username]}
                />{' '}
                on Keybase.
              </Kb.Text>
            </Kb.Box2>
          )}
          {state === 'loading' && <Kb.ProgressIndicator type="Small" style={styles.loading} />}
        </Kb.Box2>
        <Kb.Box style={styles.spaceFillingBox} />
        <ContinueButton onClick={_onContinue} disabled={!validity} />
      </Kb.Box2>
    </>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  button: {flexGrow: 0},
  containerStyle: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.blueGrey,
      flex: 1,
      padding: Styles.globalMargins.small,
      width: '100%',
    },
    isMobile: {
      zIndex: -1,
    },
  }),
  loading: {alignSelf: 'center'},
  spaceFillingBox: {flexGrow: 1},
  userMatchMention: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    marginLeft: Styles.globalMargins.small,
  },
}))

export default PhoneSearch
