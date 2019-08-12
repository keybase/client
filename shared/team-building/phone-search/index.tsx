import * as React from 'react'
import * as Kb from '../../common-adapters/index'
import PhoneInput from "../../signup/phone-number/phone-input";

type PhoneSearchProps = {
    onChangeNumber: (phonenumber: string) => void
    assertionToUsernameMap: I.Map<string, string>
}

let PhoneSearch = (props: PhoneSearchProps) => {
    const [validity, setValidity] = React.useState<boolean>(false)
    const [phoneNumber, setPhoneNumber] = React.useState<string>("")

    return (
        <>
            <PhoneInput
                autoFocus={true}
                onChangeNumber={(p) => {props.onChangeNumber(p); setPhoneNumber(p)}}
                onChangeValidity={setValidity}
                // onEnterKeyDown={props.onContinue}
            />
            <Kb.Text type="Body" selectable={true}>
                {"validity: " + JSON.stringify(validity)}
                {"phonenumber: " + JSON.stringify(phoneNumber)}
                {"map: " + JSON.stringify(props.assertionToUsernameMap)}
                {"username: " + JSON.stringify(props.assertionToUsernameMap.get(phoneNumber))}
            </Kb.Text>
        </>
    )
}

export default PhoneSearch