// @flow
import shallowEqual from 'shallowequal'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/chat2'

const getMetaMap = (state: Container.TypedState) => state.chat2.metaMap
const maxShownConversations = 5

const createShallowEqualSelector = Container.createSelectorCreator(Container.defaultMemoize, shallowEqual)

// Get conversations
const getMetas = Container.createSelector([getMetaMap], metaMap =>
  metaMap.filter((meta, id) => Constants.isValidConversationIDKey(id))
)

// Sort by timestamp
const getSortedConvMetas = Container.createSelector([getMetas], map =>
  map
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, maxShownConversations)
    .toList()
)

// Just to cache the sorted values
const GetNewestConvMetas = createShallowEqualSelector([getSortedConvMetas], map => map)

export default GetNewestConvMetas
