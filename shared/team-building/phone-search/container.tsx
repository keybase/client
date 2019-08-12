import {connect, TypedState} from "../../util/container";
import PhoneSearch from "./index";
import {createLoadContactLookup} from "../../actions/chat2-gen";

const mapDispatchToProps = dispatch => ({
    // onChangeNumber: (phoneNumber: string) => dispatch(createLoadContactLookup({contact: {name: "", components: [{label: "", phoneNumber: phoneNumber}]}}))
})

const mapStateToProps = (state: TypedState) => ({
    // assertionToUsernameMap: state.chat2.assertionToUsernameMap
})

export default connect(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, _: {}) => ({...o, ...d}),
)(PhoneSearch)
