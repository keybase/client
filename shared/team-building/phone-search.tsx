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

const PhoneSearch = (props: PhoneSearchProps) => {
  const [validity, setValidity] = React.useState<boolean>(false)
  const [phoneNumber, setPhoneNumber] = React.useState<string>('')
  const [phoneInputKey, setPhoneInputKey] = React.useState<number>(0)

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
    }
  }

  let _onContinue = () => {
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
  }

  return (
    <>
      <Kb.Box2 direction="vertical" gap="tiny" style={styles.containerStyle}>
        <PhoneInput
          // Supply a key to force reset the PhoneInput state after a user is added
          key={phoneInputKey}
          autoFocus={true}
          onChangeNumber={setPhoneNumber}
          onChangeValidity={(val: boolean, num: string) => {
            setValidity(val)
            if (val) {
              // TODO: Is this okay to reuse the 'keybase' service name? Or should we add a 'phone' one to iced?
              props.search(num, 'keybase')
            }
          }}
          result={
            // Pass a component into PhoneInput so it is displayed inline with the number input box
            validity &&
            !!user && (
              <Kb.Box2 direction="horizontal" style={styles.resultContainer}>
                <Kb.NameWithIcon
                  size="big"
                  onClick={_onContinue}
                  horizontal={true}
                  username={user.username}
                  metaOne={user.prettyName}
                />
              </Kb.Box2>
            )
          }
        />
        {validity && !user && <Kb.ProgressIndicator type="Small" style={styles.loading} />}
      </Kb.Box2>
      <Kb.Box style={styles.spaceFillingBox} />
      <Kb.Box2 direction="horizontal" style={styles.buttonContainer} fullWidth={true}>
        <Kb.Button style={styles.button} onClick={_onContinue} label="Continue" disabled={!validity} />
      </Kb.Box2>
    </>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  button: {marginBottom: Styles.globalMargins.tiny, width: '80%'},
  buttonContainer: {backgroundColor: Styles.globalColors.blueGrey, justifyContent: 'center'},
  containerStyle: {
    backgroundColor: Styles.globalColors.blueGrey,
    paddingTop: Styles.globalMargins.tiny,
    width: '100%',
  },
  loading: {alignSelf: 'center'},
  resultContainer: {margin: Styles.globalMargins.tiny, width: '100%'},
  spaceFillingBox: {backgroundColor: Styles.globalColors.blueGrey, flexGrow: 1},
}))

export default PhoneSearch
