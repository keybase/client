// @flow
import {TypedConnector} from '../../util/typed-connect'
import {navigateAppend} from '../../actions/route-tree'
import ClearCache from './index'

const connector = new TypedConnector()

export default connector.connect((state, dispatch, ownProps) => ({
  onClearCache: () => {
    dispatch(navigateAppend(['clearCacheConfirm']))
  },
}))(ClearCache)
