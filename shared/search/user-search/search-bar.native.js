// @flow
import React, {Component} from 'react'
import _ from 'lodash'

import {Box, Icon, Input, ClickableBox} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'
import {platformToLogo24} from '../../constants/search'

import type {SearchPlatforms} from '../../constants/search'
import type {Props} from './search-bar'

const ServiceIcon = ({serviceName, iconType, selected, onClickService}) => (
  <ClickableBox
    style={{
      ...serviceContainerStyle,
      backgroundColor: selected ? globalColors.blue4 : null,
    }}
    onClick={() => onClickService(serviceName)}
  >
    <Box>
      <Icon type={iconType} style={{opacity: selected ? 1 : 0.6}} />
    </Box>
  </ClickableBox>
)

type State = {
  overridePlatform: ?SearchPlatforms,
}

class SearchBar extends Component<void, Props, State> {
  _search: any
  state: State = {
    overridePlatform: null,
  }

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.searchTextClearTrigger !== nextProps.searchTextClearTrigger) {
      this._clear()
    }
  }

  _onSearch = () => {
    const term = this._searchTerm()
    this.props.onSearch(term, this.state.overridePlatform)
  }

  _onDebouncedSearch = _.debounce(this._onSearch, 500)

  _onClickService = (overridePlatform: SearchPlatforms) => {
    this.setState({overridePlatform}, () => {
      this._onSearch()
      if (this._search) {
        this._search.focus()
      }
    })
    this.props.onClickService(overridePlatform)
  }

  _searchTerm = () => {
    return this._search ? this._search.getValue() : ''
  }

  _clear = () => {
    this._search && this._search.clearValue()
  }

  _setSearchRef = r => {
    this._search = r
  }

  render() {
    const services = ['Keybase', 'Twitter', 'Facebook', 'Github', 'Reddit', 'Hackernews']
    const tooltips: {[key: string]: ?string} = {Hackernews: 'Hacker News'}

    return (
      <Box style={{...globalStyles.flexBoxColumn, flexShrink: 0}}>
        <Box style={stylesServicesContainer}>
          {services.map(s => (
            <ServiceIcon
              key={s}
              serviceName={s}
              tooltip={tooltips[s] || s}
              iconType={platformToLogo24(s)}
              selected={this.props.selectedService === s}
              onClickService={this._onClickService}
            />
          ))}
        </Box>
        <Box style={stylesInputContainer}>
          <Input
            small={true}
            hideUnderline={true}
            type="text"
            ref={this._setSearchRef}
            onEnterKeyDown={this._onSearch}
            onChangeText={this._onDebouncedSearch}
            hintText={this.props.searchHintText}
            style={{paddingLeft: 20}}
            inputStyle={stylesInput}
          />
          <Icon
            type="iconfont-remove"
            style={{marginRight: 16, opacity: this.props.searchText ? 1 : 0}}
            onClick={this._clear}
          />
        </Box>
      </Box>
    )
  }
}

const stylesServicesContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: 64,
  paddingLeft: 16,
}
const stylesInputContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: 48,
}
const stylesInput = {
  textAlign: 'left',
}
const serviceContainerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  borderRadius: 25,
  height: 50,
  justifyContent: 'center',
  position: 'relative',
  width: 50,
}

export default SearchBar
