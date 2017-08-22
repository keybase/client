// @flow
import {TypedConnector} from '../../util/typed-connect'
import {navigateAppend} from '../../actions/route-tree'
import Delete from './index'

const connector = new TypedConnector()

export default connector.connect((state, dispatch, ownProps) => ({
  onDelete: () => {
    dispatch(navigateAppend(['deleteConfirm']))
  },
}))(Delete)
