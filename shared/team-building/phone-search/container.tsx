import {connect, TypedState} from '../../util/container'
import PhoneSearch from './index'
import {createLoadContactLookup} from '../../actions/chat2-gen'
import {User} from 'constants/types/team-building'

type OwnProps = {
    onContinue: (user: User) => void
}

const mapDispatchToProps = dispatch => ({
    onChangeNumber: (phoneNumber: string) =>
        dispatch(
            createLoadContactLookup({contact: {components: [{label: '', phoneNumber: phoneNumber}], name: ''}})
        ),
})

const mapStateToProps = (state: TypedState) => ({
    assertionToContactMap: state.chat2.assertionToContactMap,
})

export default connect(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o: OwnProps) => ({...s, ...d, ...o})
)(PhoneSearch)
