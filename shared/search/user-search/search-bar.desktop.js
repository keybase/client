// @flow
import React, {Component} from 'react'
import _ from 'lodash'
import {Box, Icon, Input, Text} from '../../common-adapters'
import {globalStyles, globalColors, transition} from '../../styles'
import {platformToLogo24} from '../../constants/search'
import {withState, withProps, compose, withHandlers} from 'recompose'

import type {SearchPlatforms} from '../../constants/search'
import type {ServiceFn} from './render'
import type {IconType} from '../../common-adapters/icon'
import type {Props} from './search-bar'

type ServiceIconProps = {
  serviceName: SearchPlatforms,
  tooltip: string,
  iconType: IconType,
  selected: boolean,
  onClickService: ServiceFn,
  onMouseEnter: () => void,
  onMouseLeave: () => void,
  onClick: () => void,
  showingTooltip: boolean,
}

const _ServiceIcon = ({serviceName, tooltip, iconType, selected, onClick, onMouseEnter, onMouseLeave, showingTooltip}: ServiceIconProps) => (
  <Box style={{...serviceContainerStyle, backgroundColor: selected ? globalColors.blue4 : null}}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
    onClick={onClick} >
    <Icon type={iconType} style={{...serviceIconStyle, opacity: selected || showingTooltip ? 1.0 : 0.6}} />
    <Text type='BodySmall' style={{...serviceTooltipStyle, opacity: showingTooltip ? 1 : 0}}>{tooltip}</Text>
  </Box>
)

const ServiceIcon =
  compose(
    withState('showingTooltip', 'setShowingTooltip', false),
    withHandlers({
      onClick: props => event => props.onClickService(props.serviceName),
      onMouseEnter: props => event => props.setShowingTooltip(true),
      onMouseLeave: props => event => props.setShowingTooltip(false),
    })
  )(_ServiceIcon)

const _services = ['Keybase', 'Twitter', 'Facebook', 'Github', 'Coinbase', 'Reddit', 'Hackernews']
const _tooltips: {[key: string]: ?string} = {'Hackernews': 'Hacker News'}

type ComposedProps = {
  onSearch: () => void,
  setSelectedService: (platform: SearchPlatforms) => void,
  setSearchText: (term: string) => void,
  onEnterKeyDown: () => void,
  onChangeText: () => void,
}

class _SearchBar extends Component<void, Props & ComposedProps, void> {
  _onClickService (platform: SearchPlatforms) {
    this.props.onClickService(platform)
    if (this.refs.searchBox) {
      this.refs.searchBox.focus()
    }

    this.props.setSelectedService(platform)
    this.props.onSearch()
  }

  render () {
    return (
      <Box style={{...globalStyles.flexBoxColumn, flexShrink: 0}}>
        <Box style={stylesServicesContainer}>
          {_services.map(s => (
            <ServiceIcon
              key={s}
              serviceName={s}
              tooltip={_tooltips[s] || s}
              iconType={platformToLogo24(s)}
              selected={this.props.selectedService === s}
              onClickService={p => this._onClickService(p)}
              />
          ))}
        </Box>
        <Box style={stylesInputContainer}>
          <Input
            small={true}
            hideUnderline={true}
            type='text'
            autoFocus={true}
            ref='searchBox'
            onEnterKeyDown={this.props.onEnterKeyDown}
            onChangeText={this.props.onChangeText}
            value={this.props.searchText}
            hintText={this.props.searchHintText}
            style={{paddingLeft: 20}}
            inputStyle={stylesInput}
          />
          <Icon type='iconfont-remove' style={{marginRight: 16, opacity: this.props.searchText ? 1 : 0}}
            onClick={() => this.refs.searchBox.clearValue()} />
        </Box>
      </Box>
    )
  }
}

const stylesServicesContainer = {
  ...globalStyles.flexBoxRow,
  height: 64,
  alignItems: 'center',
  paddingLeft: 16,
}
const stylesInputContainer = {
  ...globalStyles.flexBoxRow,
  height: 48,
  alignItems: 'center',
}
const stylesInput = {
  textAlign: 'left',
}
const serviceContainerStyle = {
  ...globalStyles.flexBoxColumn,
  ...transition('backgroundColor'),
  alignItems: 'center',
  borderRadius: 25,
  cursor: 'pointer',
  height: 50,
  justifyContent: 'center',
  position: 'relative',
  width: 50,
}
const serviceIconStyle = {
  ...transition('opacity'),
}
const serviceTooltipStyle = {
  ...transition('opacity'),
  backgroundColor: globalColors.black_40,
  borderBottom: '2px solid white',
  borderRadius: 65,
  color: globalColors.white,
  cursor: 'default',
  left: -16,
  lineHeight: '22px',
  minHeight: 22,
  minWidth: 86,
  position: 'absolute',
  textAlign: 'center',
  top: -24,
}

export default compose(
  withState('searchText', 'setSearchText', props => props.searchText),
  withState('selectedService', 'setSelectedService', props => props.selectedService),
  withProps(props => ({
    onSearch: () => {
      console.log('aaaaaa', props.searchText, props.selectedService)
      props.onSearch(props.searchText, props.selectedService)
    },
  })),
  withProps(props => ({
    onDebouncedSearch: _.debounce(props.onSearch, 500),
  })),
  withHandlers({
    onEnterKeyDown: props => props.onSearch,
    onChangeText: props => term => {
      props.setSearchText(term)
      props.onDebouncedSearch()
    },
  })
)(_SearchBar)
