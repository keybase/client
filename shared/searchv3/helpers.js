// @flow

import {compose, withHandlers, withPropsOnChange, withState, lifecycle} from 'recompose'
import * as Constants from '../constants/searchv3'
import debounce from 'lodash/debounce'

const debounceTimeout = 1e3

type OwnProps = {
  onChangeSearchText: (s: string) => void,
  search: (term: string, service: Constants.Service) => void,
  selectedService: Constants.Service,
  searchResultIds: Array<Constants.SearchResultId>,
  selectedSearchId: ?Constants.SearchResultId,
  onUpdateSelectedSearchResult: (id: ?Constants.SearchResultId) => void,
  onAddSelectedUser: (id: Constants.SearchResultId) => void,
  searchResultTerm: string,
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

type OwnPropsWithSearchDebounced = OwnProps & {_searchDebounced: $PropertyType<OwnProps, 'search'>}

const onChangeSelectedSearchResultHoc = compose(
  withHandlers({
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
    _searchDebounced: debounce(search, debounceTimeout),
  })),
  withHandlers(() => {
    let lastSearchTerm
    return {
      // onAddSelectedUser happens on desktop when tab, enter or comma
      // is typed, so we expedite the current search, if any
      onAddSelectedUser: (props: OwnPropsWithSearchDebounced) => () => {
        props._searchDebounced.flush()
        // See whether the current search result term matches the last one submitted
        if (lastSearchTerm === props.searchResultTerm) {
          props.selectedSearchId && props.onAddSelectedUser(props.selectedSearchId)
          props.onChangeSearchText('')
        }
      },
      onMoveSelectUp: ({onMove}) => () => onMove('up'),
      onMoveSelectDown: ({onMove}) => () => onMove('down'),
      onChangeText: (props: OwnPropsWithSearchDebounced) => nextText => {
        lastSearchTerm = nextText
        props.onChangeSearchText(nextText)
        if (nextText === '') {
          // In case we have a search that would fire after our other search
          props._searchDebounced.cancel()
          props.search(nextText, props.selectedService)
        } else {
          props._searchDebounced(nextText, props.selectedService)
        }
      },
    }
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
  clearSearchHoc,
  onChangeSelectedSearchResultHoc,
  placeholderServiceHoc,
  selectedSearchIdHoc,
  showServiceLogicHoc,
}
