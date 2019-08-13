import * as React from 'react'
import * as Kb from '../../common-adapters/index'
import PhoneInput from "../../signup/phone-number/phone-input";
import {Avatar} from "../../common-adapters/index";
import * as Styles from '../../styles'
import * as RPCTypes from '../../constants/types/rpc-gen'

type PhoneSearchProps = {
    onChangeNumber: (phonenumber: string) => void
    assertionToContactMap: I.Map<string, RPCTypes.ProcessedContact>
}

let PhoneSearch = (props: PhoneSearchProps) => {
    const [validity, setValidity] = React.useState<boolean>(false)
    const [phoneNumber, setPhoneNumber] = React.useState<string>("")

    let user = props.assertionToContactMap.get(phoneNumber)

    return (
        <>
            <PhoneInput
                autoFocus={true}
                onChangeNumber={(p) => {props.onChangeNumber(p); setPhoneNumber(p)}}
                onChangeValidity={setValidity}
                // onEnterKeyDown={props.onContinue}
            />
            {validity && user && (
                <Kb.Box2 direction="horizontal">
                    <Avatar size={48} username={user.username} showFollowingStatus={true} style={{paddingRight: Styles.globalMargins.tiny}}/>
                    <Kb.Box2 direction="vertical">
                        <Kb.Text type="BodySemibold" style={{color: Styles.globalColors.green}}>
                            {user.username}
                        </Kb.Text>
                        <Kb.Text type="Body">
                            {user.fullName}
                        </Kb.Text>
                    </Kb.Box2>
                </Kb.Box2>
                )}
            <Kb.Text type="Body" selectable={true}>
                {"validity: " + JSON.stringify(validity)}
                {"phonenumber: " + JSON.stringify(phoneNumber)}
                {"map: " + JSON.stringify(props.assertionToContactMap)}
                {"userinfo: " + JSON.stringify(user)}
            </Kb.Text>
            <Kb.Box style={{flexDirection: "column", flexGrow: 1}}>

            </Kb.Box>
            <Kb.Button style={{flexGrow: 0}} fullWidth={true} onClick={() => alert("CLICKED")} label="Continue" disabled={!(validity && user)}/>
        </>
    )
}

export default PhoneSearch