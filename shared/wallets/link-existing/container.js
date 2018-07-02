// @flow
import {connect, type TypedState} from '../../util/container'
import * as WalletsGen from '../../actions/wallets-gen'
import HiddenString from '../../util/hidden-string'
import {Wrapper as LinkExisting} from '.'

const mapStateToProps = (state: TypedState) => ({})

const mapDispatchToProps = (dispatch: Dispatch, {navigateUp}) => ({
  onCancel: () => dispatch(navigateUp()),
  onDone: (sk: string, name: string) =>
    dispatch(WalletsGen.createLinkExistingAccount({name, secretKey: new HiddenString(sk)})),
})

export default connect(mapStateToProps, mapDispatchToProps)(LinkExisting)
