// @flow
import * as Constants from '../../constants/fs'
import * as FsTypes from '../../constants/types/fs'
import {namedConnect} from '../../util/container'
import Banner from '.'

type OwnProps = {|path: FsTypes.Path|}

const mapStateToProps = (state, {path}: OwnProps) => ({
  path,
  shouldShowReset: Constants.getTlfFromPath(state.fs.tlfs, path).resetParticipants.size > 0,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  () => ({}),
  (s, d, o) => ({...o, ...s, ...d}),
  'Banner'
)(Banner)
