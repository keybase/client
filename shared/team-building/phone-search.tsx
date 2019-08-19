import * as React from 'react'
import * as Kb from '../common-adapters/index'
import PhoneInput from '../signup/phone-number/phone-input'
import * as Styles from '../styles'
import {ServiceIdWithContact, User} from 'constants/types/team-building'

type PhoneSearchProps = {
    onContinue: (user: User) => void
    search: (query: string, service: ServiceIdWithContact) => void
    teamBuildingSearchResults: any
}

const PhoneSearch = (props: PhoneSearchProps) => {
    const [validity, setValidity] = React.useState<boolean>(false)
    const [phoneNumber, setPhoneNumber] = React.useState<string>('')
    const [phoneInputKey, setPhoneInputKey] = React.useState<number>(0)

    let user: User | null = null
    if (validity && props.teamBuildingSearchResults && props.teamBuildingSearchResults[phoneNumber] && props.teamBuildingSearchResults[phoneNumber].keybase && props.teamBuildingSearchResults[phoneNumber].keybase[0]) {
        let serviceMap = props.teamBuildingSearchResults[phoneNumber].keybase[0].serviceMap
        let username = props.teamBuildingSearchResults[phoneNumber].keybase[0].serviceMap.keybase
        let fullname = props.teamBuildingSearchResults[phoneNumber].keybase[0].fullname
        user = {
            id: username,
            prettyName: fullname,
            serviceId: 'keybase',
            serviceMap,
            username,
        }
    }

    let _onContinue = () => {
        if (user) {
            props.onContinue(user)
            setPhoneNumber('')
            setPhoneInputKey(old => old + 1)
            setValidity(false)
        }
    }

    return (
        <>
            <Kb.Box2
                direction="vertical"
                gap="tiny"
                style={{
                    backgroundColor: Styles.globalColors.greyLight,
                    marginTop: Styles.globalMargins.tiny,
                    width: '100%',
                }}
            >
                <PhoneInput
                    // Supply a key to force reset the PhoneInput state after a user is added
                    key={phoneInputKey}
                    autoFocus={true}
                    onChangeNumber={p => {
                        setPhoneNumber(p)
                        // TODO: Is this okay to reuse the 'keybase' service name? Or should we add a 'phone' one to iced?
                        props.search(p, 'keybase')
                    }}
                    onChangeValidity={setValidity}
                    result={
                        // Pass a component into PhoneInput so it is displayed inline with the number input box
                        validity &&
                        !!user && (
                            <Kb.ClickableBox onClick={_onContinue}>
                                <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
                                    <Kb.Avatar size={48} username={user.username} showFollowingStatus={true} />
                                    <Kb.Box2 direction="vertical">
                                        <Kb.Text type="BodySemibold" style={{color: Styles.globalColors.greenDark}}>
                                            {user.username}
                                        </Kb.Text>
                                        <Kb.Text type="Body">{user.prettyName}</Kb.Text>
                                    </Kb.Box2>
                                </Kb.Box2>
                            </Kb.ClickableBox>
                        )
                    }
                />
                {validity && !user && <Kb.ProgressIndicator type="Small" />}
            </Kb.Box2>
            <Kb.Box style={{backgroundColor: Styles.globalColors.greyLight, flexGrow: 1}} />
            <Kb.Button
                style={{flexGrow: 0}}
                fullWidth={true}
                onClick={_onContinue}
                label="Continue"
                disabled={!(validity && user)}
            />
        </>
    )
}

export default PhoneSearch
