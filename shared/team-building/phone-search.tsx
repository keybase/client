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
          />
          {state === 'resolved' && !!user && (
            <Kb.Box2 direction="horizontal" style={styles.resultContainer}>
              <Kb.NameWithIcon
                containerStyle={styles.nameWithIconContainer}
                size="big"
                onClick={_onContinue}
                horizontal={true}
                username={user.username}
                metaOne={user.prettyName}
              />
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
  nameWithIconContainer: {width: '100%'},
  resultContainer: {margin: Styles.globalMargins.tiny, width: '100%'},
  spaceFillingBox: {flexGrow: 1},
}))

export default PhoneSearch
