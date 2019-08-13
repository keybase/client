import {connect, TypedState} from "../../util/container";
import PhoneSearch from "./index";
import {createLoadContactLookup} from "../../actions/chat2-gen";

const mapDispatchToProps = dispatch => ({
    onChangeNumber: (phoneNumber: string) => dispatch(createLoadContactLookup({contact: {name: "", components: [{label: "", phoneNumber: phoneNumber}]}})),
    onContinue: (phoneNumberOrUsername: string) => alert("Hit continue with data: " + JSON.stringify(phoneNumberOrUsername)),
})

const mapStateToProps = (state: TypedState) => ({
    assertionToContactMap: state.chat2.assertionToContactMap
})

export default connect(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, _: {}) => ({...s, ...d}),
)(PhoneSearch)
