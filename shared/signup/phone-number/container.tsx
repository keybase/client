import * as Container from '../../util/container'
import * as SettingsGen from '../../actions/settings-gen'
import EnterPhoneNumber from '.'

const mapStateToProps = state => ({})

const mapDispatchToProps = dispatch => ({
  onContinue: (phoneNumber: string, allowSearch: boolean) =>
    dispatch(SettingsGen.createAddPhoneNumber({allowSearch, phoneNumber})),
})

const ConnectedEnterPhoneNumber = Container.connect(mapStateToProps, mapDispatchToProps)(EnterPhoneNumber)

export default ConnectedEnterPhoneNumber
