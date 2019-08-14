import * as React from 'react'
import * as Kb from '../../common-adapters/index'
import PhoneInput from '../../signup/phone-number/phone-input'
import * as Styles from '../../styles'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as I from 'immutable'

type PhoneSearchProps = {
  onChangeNumber: (phoneNumber: string) => void
  assertionToContactMap: I.Map<string, RPCTypes.ProcessedContact>
  onContinue: (phoneNumberOrUsername: string) => void
}

const PhoneSearch = (props: PhoneSearchProps) => {
  const [validity, setValidity] = React.useState<boolean>(false)
  const [phoneNumber, setPhoneNumber] = React.useState<string>('')

  let user = props.assertionToContactMap.get(phoneNumber)

  let _onContinue = () => props.onContinue(user ? user.username : phoneNumber)

  return (
    <>
      <Kb.Box2
        direction="vertical"
        gap="tiny"
        style={{backgroundColor: Styles.globalColors.greyLight, marginTop: Styles.globalMargins.tiny}}
      >
        <PhoneInput
          autoFocus={true}
          onChangeNumber={p => {
            props.onChangeNumber(p)
            setPhoneNumber(p)
          }}
          onChangeValidity={setValidity}
          result={
            validity &&
            !!user && (
              <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
                <Kb.Avatar
                  size={48}
                  username={user.username}
                  showFollowingStatus={true}
                  onClick={_onContinue}
                />
                <Kb.Box2 direction="vertical">
                  <Kb.Text
                    type="BodySemibold"
                    style={{color: Styles.globalColors.greenDark}}
                    onClick={_onContinue}
                  >
                    {user.username}
                  </Kb.Text>
                  <Kb.Text type="Body" onClick={_onContinue}>
                    {user.fullName}
                  </Kb.Text>
                </Kb.Box2>
              </Kb.Box2>
            )
          }
        />
        {validity && !user && <Kb.ProgressIndicator type="Small" />}
      </Kb.Box2>
      <Kb.Box
        style={{backgroundColor: Styles.globalColors.greyLight, flexDirection: 'column', flexGrow: 1}}
      />
      <Kb.Button
        style={{flexGrow: 0}}
        fullWidth={true}
        onClick={_onContinue}
        label="Continue"
        disabled={!validity}
      />
    </>
  )
}

export default PhoneSearch
