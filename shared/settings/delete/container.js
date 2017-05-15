// @flow
import {TypedConnector} from '../../util/typed-connect'
import {navigateAppend} from '../../actions/route-tree'
import Delete from './index'

import type {TypedDispatch} from '../../constants/types/flux'
import type {TypedState} from '../../constants/reducer'
import type {Props} from './index'

const connector: TypedConnector<TypedState, TypedDispatch<{}>, {}, Props> = new TypedConnector()

export default connector.connect((state, dispatch, ownProps) => ({
  onDelete: () => {
    dispatch(navigateAppend(['deleteConfirm']))
  },
}))(Delete)
