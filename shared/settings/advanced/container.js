// @flow
import * as ConfigGen from '../../actions/config-gen'
import {navigateAppend, navigateUp} from '../../actions/route-tree'
import {HeaderHoc} from '../../common-adapters'
import {compose} from 'recompose'
import DBNuke from './index'
import {connect, type TypedState} from '../../util/container'

const mapStateToProps = (state: TypedState) => ({
  openAtLogin: state.config.openAtLogin,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => {
    dispatch(navigateUp())
  },
  onDBNuke: () => {
    dispatch(navigateAppend(['dbNukeConfirm']))
  },
  onSetOpenAtLogin: (open: boolean) => dispatch(ConfigGen.createSetOpenAtLogin({open, writeFile: true})),
})

const connectedDBNuke = compose(connect(mapStateToProps, mapDispatchToProps), HeaderHoc)(DBNuke)
export default connectedDBNuke
