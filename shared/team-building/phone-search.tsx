import * as React from 'react'
import * as Kb from '../common-adapters/index'
import PhoneInput from '../signup/phone-number/phone-input'
import * as Styles from '../styles'
import {ServiceIdWithContact, User} from 'constants/types/team-building'

type PhoneSearchProps = {
  onContinue: (user: User) => void
  search: (query: string, service: ServiceIdWithContact) => void
  teamBuildingSearchResults: {[query: string]: {[service in ServiceIdWithContact]: Array<User>}}
}

type CurrentState = 'resolved' | 'loading' | 'notfound' | 'none'

const PhoneSearch = (props: PhoneSearchProps) => {
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
      props.onContinue(user)
    } else {
      // Continue in order to start a conversation with their phone number
      props.onContinue({
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
  }, [user, phoneNumber])

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
          {state === 'notfound' && (
            <Kb.Box2 direction="horizontal" style={styles.resultContainer} gap="tiny">
              <Kb.Box2 direction="vertical" fullHeight={true} style={styles.justifyCenter}>
                <Kb.Icon type="icon-placeholder-avatar-32" style={styles.placeholderIcon} />
              </Kb.Box2>
              <Kb.Box2 direction="vertical" fullHeight={true} style={styles.justifyCenter}>
                <Kb.Text type="BodyBig">User not found</Kb.Text>
              </Kb.Box2>
            </Kb.Box2>
          )}
          {state === 'loading' && <Kb.ProgressIndicator type="Small" style={styles.loading} />}
        </Kb.Box2>
        <Kb.Box style={styles.spaceFillingBox} />
        <Kb.Button
          fullWidth={true}
          style={styles.button}
          onClick={_onContinue}
          label="Continue"
          disabled={!validity}
        />
      </Kb.Box2>
    </>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  button: {flexGrow: 0},
  buttonContainer: {justifyContent: 'center'},
  containerStyle: {
    backgroundColor: Styles.globalColors.blueGrey,
    height: '100%',
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
    width: '100%',
  },
  justifyCenter: {justifyContent: 'center'},
  loading: {alignSelf: 'center'},
  nameWithIconContainer: {width: '100%'},
  placeholderIcon: {borderRadius: 16, height: 32},
  resultContainer: {margin: Styles.globalMargins.tiny, width: '100%'},
  spaceFillingBox: {flexGrow: 1},
}))

export default PhoneSearch
