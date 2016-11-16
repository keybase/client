// @flow
import React, {Component} from 'react'
import _ from 'lodash'

import {Box, Icon, Input, Text} from '../../common-adapters'
import {globalStyles, globalColors, transition} from '../../styles'
import {platformToLogo24} from '../../constants/search'

import type {SearchPlatforms} from '../../constants/search'
import type {ServiceFn} from './render'
import type {IconType} from '../../common-adapters/icon'
import type {Props} from './search-bar'

type ServiceIconState = {showingTooltip: boolean}
type ServiceIconProps = {serviceName: SearchPlatforms, tooltip: string,
  iconType: IconType, selected: boolean, onClickService: ServiceFn}
class ServiceIcon extends Component<void, ServiceIconProps, ServiceIconState> {
  state: ServiceIconState;

  constructor (props: ServiceIconProps) {
    super(props)

    this.state = {
      showingTooltip: false,
    }
  }

  render () {
    const {serviceName, tooltip, iconType, selected, onClickService} = this.props
    return (
      <Box style={{...serviceContainerStyle, backgroundColor: selected ? globalColors.blue4 : null}}
        onMouseEnter={() => this.setState({showingTooltip: true})}
        onMouseLeave={() => this.setState({showingTooltip: false})}
        onClick={() => onClickService(serviceName)} >
        <Icon type={iconType} style={{...serviceIconStyle,
          opacity: selected || this.state.showingTooltip ? 1.0 : 0.6}} />
        <Text type='BodySmall' style={{...serviceTooltipStyle,
          opacity: this.state.showingTooltip ? 1 : 0}}>{tooltip}</Text>
      </Box>
    )
  }
}

class SearchBar extends Component<void, Props, void> {
  _onDebouncedSearch: (overridePlatform?: SearchPlatforms) => void;

  constructor (props: Props) {
    super(props)
    this._onDebouncedSearch = _.debounce(this._onSearch, 500)
  }

  componentWillReceiveProps (nextProps: Props) {
    if (nextProps.searchText === null && nextProps.searchText !== this.props.searchText) {
      this.refs && this.refs.searchBox && this.refs.searchBox.clearValue()
    }
  }

  _onSearch (overridePlatform?: SearchPlatforms) {
    this.props.onSearch(this.refs.searchBox ? this.refs.searchBox.getValue() : '', overridePlatform || null)
  }

  _onClickService (platform: SearchPlatforms) {
    this.props.onClickService(platform)
    if (this.refs.searchBox) {
      if (this.refs.searchBox.getValue()) {
        this._onSearch(platform)
      }
      this.refs.searchBox.focus()
    }
  }

  render () {
    const services = ['Keybase', 'Twitter', 'Facebook', 'Github', 'Coinbase', 'Reddit', 'Hackernews']
    const tooltips: {[key: string]: ?string} = {'Hackernews': 'Hacker News'}

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
            onEnterKeyDown={() => this._onSearch()}
            onChangeText={() => this._onDebouncedSearch()}
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

export default SearchBar
