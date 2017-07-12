// @flow

import {compose, withHandlers, withPropsOnChange, withState, lifecycle} from 'recompose'
import * as Constants from '../constants/searchv3'
import debounce from 'lodash/debounce'

type OwnProps = {
  onChangeSearchText: (s: string) => void,
  search: (term: string, service: Constants.Service) => void,
  selectedService: Constants.Service,

  searchResultIds: Array<Constants.SearchResultId>,
  selectedSearchId: ?Constants.SearchResultId,
  onUpdateSelectedSearchResult: (id: ?Constants.SearchResultId) => void,
  onAddSelectedUser: (id: Constants.SearchResultId) => void,
}

// Which search result is highlighted
const selectedSearchIdHoc = compose(
  withState('selectedSearchId', 'onUpdateSelectedSearchResult', null),
  lifecycle({
    componentWillReceiveProps: function(nextProps: OwnProps) {
      if (this.props.searchResultIds !== nextProps.searchResultIds) {
        nextProps.onUpdateSelectedSearchResult(
          (nextProps.searchResultIds && nextProps.searchResultIds[0]) || null
        )
      }
    },
  })
)

// TODO hook up this type
/*
type InProps = {
  onRemoveUser: (id: Constants.SearchResultId) => void,
  onExitSearch: () => void,
  userItems: Array<{id: Constants.SearchResultId}>,
  searchText: string,
  onChangeSearchText: (nextText: string) => void,
  clearSearchResults: () => void,
  search: (search: string, service: Constants.Service) => void,
}

type OutProps = {
  onClearSearch: () => void,
}
*/
const clearSearchHoc = withHandlers({
  onClearSearch: ({onExitSearch}) => () => onExitSearch(),
})

const onChangeSelectedSearchResultHoc = compose(
  withHandlers({
    onAddSelectedUser: ({onChangeSearchText, onAddSelectedUser, selectedSearchId}: OwnProps) => () => {
      selectedSearchId && onAddSelectedUser(selectedSearchId)
      onChangeSearchText('')
    },
    onMove: ({onUpdateSelectedSearchResult, selectedSearchId, searchResultIds}: OwnProps) => (
      direction: 'up' | 'down'
    ) => {
      const index = selectedSearchId ? searchResultIds.indexOf(selectedSearchId) : -1

      const nextIndex = index === -1
        ? 0
        : direction === 'down' ? Math.min(index + 1, searchResultIds.length - 1) : Math.max(index - 1, 0)
      const nextSelectedSearchId = searchResultIds[nextIndex]
      onUpdateSelectedSearchResult(nextSelectedSearchId)
    },
  }),
  withPropsOnChange(['search'], ({search}: OwnProps) => ({
    _searchDebounced: debounce(search, 1e3),
  })),
  withHandlers({
    onMoveSelectUp: ({onMove}) => () => onMove('up'),
    onMoveSelectDown: ({onMove}) => () => onMove('down'),
    onChangeText: (props: OwnProps & {_searchDebounced: $PropertyType<OwnProps, 'search'>}) => nextText => {
      props.onChangeSearchText(nextText)
      if (nextText === '') {
        // In case we have a search that would fire after our other search
        props._searchDebounced.cancel()
        props.search(nextText, props.selectedService)
      } else {
        props._searchDebounced(nextText, props.selectedService)
      }
    },
  })
)

const showServiceLogicHoc = withPropsOnChange(
  ['addNewParticipant', 'searchText', 'userItems'],
  ({addNewParticipant, searchText, userItems}) => ({
    showServiceFilter: !!searchText || userItems.length === 0 || addNewParticipant,
  })
)

const placeholderServiceHoc = withPropsOnChange(['selectedService'], ({selectedService}) => ({
  placeholder: `Search ${selectedService}`,
}))

export {
  onChangeSelectedSearchResultHoc,
  placeholderServiceHoc,
  selectedSearchIdHoc,
  showServiceLogicHoc,
  clearSearchHoc,
}
