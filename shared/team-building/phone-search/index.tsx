import * as React from 'react'
import * as Kb from '../../common-adapters/index'
import PhoneInput from "../../signup/phone-number/phone-input";

type PhoneSearchProps = {
    onChangeNumber: (phonenumber: string) => void
    assertionToUsernameMap: I.Map<string, string>
}

export default PhoneSearch = (props: PhoneSearchProps) => {
    // const [validity, setValidity] = React.useState<boolean>(false)
    // const [phoneNumber, setPhoneNumber] = React.useState<boolean>(false)

    return (
        <>
            {/*<PhoneInput*/}
            {/*    autoFocus={true}*/}
            {/*    onChangeNumber={(p) => {props.onChangeNumber(p); setPhoneNumber(p)}}*/}
            {/*    onChangeValidity={setValidity}*/}
            {/*    // onEnterKeyDown={props.onContinue}*/}
            {/*/>*/}
            {/*<Kb.Text>*/}
            {/*    {"validity: " + JSON.stringify(validity)}*/}
            {/*    {"username: " + JSON.stringify(props.assertionToUsernameMap[phoneNumber])}*/}
            {/*</Kb.Text>*/}
        </>
    )
}
TOD