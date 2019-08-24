import {Component} from 'react'

import {SearchResultId} from '../../constants/types/search'

export type Props = {
  style?: any
  items: Array<SearchResultId>
  keyboardDismissMode?: 'none' | 'on-drag'
  onClick: (id: SearchResultId) => void
  onMouseOver?: (id: SearchResultId) => void
  onShowTracker?: (id: SearchResultId) => void
  searchKey: string
  selectedId: SearchResultId | null
  showSearchSuggestions: boolean
  disableIfInTeamName: string | null
}

export default class ResultsList extends Component<Props> {}
