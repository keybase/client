// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {compose, connect, setDisplayName, type TypedState} from '../../util/container'
import Uploading from './uploading'

type OwnProps = {
  transferID: string,
}

const mapStateToProps = (state: TypedState, {transferID}: OwnProps) => {
  const _transfer = state.fs.transfers.get(transferID, Constants.makeTransfer())
  const _username = state.config.username
  return {
    _transfer,
    _username,
  }
}

const mergeProps = ({_transfer, _name, _username}, {routePath}) => ({
  name: Types.getPathName(_transfer.meta.path),
  itemStyles: Constants.getItemStyles(
    Types.getPathElements(_transfer.meta.path),
    _transfer.meta.entryType,
    _username
  ),
})

export default compose(
  connect(mapStateToProps, undefined, mergeProps),
  setDisplayName('ConnectedUploadingRow')
)(Uploading)
