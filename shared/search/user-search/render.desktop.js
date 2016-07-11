// @flow
import React, {Component} from 'react'
import _ from 'lodash'

import {Avatar, Box, ClickableBox, Icon, Input, Text} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles/style-guide'

import {IconButton} from 'material-ui'
import {platformToLogo24} from '../../constants/search'

import type {SearchResult, SearchPlatforms} from '../../constants/search'
import type {Props, SearchResultFn, ServiceFn} from './render'
import type {IconType} from '../../common-adapters/icon'
import type {Props as TextProps} from '../../common-adapters/text'

function EmboldenTextMatch ({text, match, style, textType, emboldenStyle}: {text: string, match: string, emboldenStyle?: Object, style?: Object, textType: TextProps.type}) {
  const indexOfMatch = text.indexOf(match)
  if (indexOfMatch > -1) {
    return (
      <Box style={globalStyles.flexBoxRow}>
        <Text type={textType} style={style}>{text.substring(0, indexOfMatch)}</Text>
        <Text type={textType} style={{...globalStyles.fontBold, ...style, ...emboldenStyle}}>{match}</Text>
        <EmboldenTextMatch style={style} text={text.substring(indexOfMatch + match.length)} match={match} textType={textType} emboldenStyle={emboldenStyle} />
      </Box>
    )
  }

  return <Text type={textType} style={style}>{text}</Text>
}

function KeybaseResultBody ({username, searchText, isFollowing}) {
  return <EmboldenTextMatch text={username} match={searchText} textType={'Body'} style={{color: isFollowing ? globalColors.green2 : globalColors.orange}} />
}

function ExternalResultBody ({username, searchText}) {
  return <EmboldenTextMatch text={username} match={searchText} textType={'Body'} style={{color: globalColors.black_75}} />
}

function KeybaseExtraInfo ({username, fullName, isFollowing, searchText}) {
  return (
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'flex-end'}}>
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
        <Avatar size={16} style={{width: 16, marginRight: 4}} username={username} />
        <EmboldenTextMatch text={username} match={searchText} textType={'BodySmall'} style={{color: isFollowing ? globalColors.green2 : globalColors.orange}} />
      </Box>
      {!!fullName && <Text type='BodyXSmall' style={{color: globalColors.black_40}}>{fullName}</Text>}
    </Box>
  )
}

// TODO(MM) use serviceAvatar
function ExternalExtraInfo ({serviceUsername, fullNameOnService, icon, searchText}) {
  return (
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'flex-end'}}>
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
        <Icon type={icon} style={{width: 17, marginRight: 4}} />
        <EmboldenTextMatch text={serviceUsername} match={searchText} textType={'BodySmall'} emboldenStyle={{color: globalColors.black_75}} />
      </Box>
      {!!fullNameOnService && <Text type='BodyXSmall' style={{color: globalColors.black_40}}>{fullNameOnService}</Text>}
    </Box>
  )
}

export function Result ({result, searchText, onClickResult}: {result: SearchResult, searchText: string, onClickResult: SearchResultFn}) {
  const iconStyle = {height: 32, width: 32, marginRight: 16}

  let icon
  let body = <Box />
  switch (result.service) {
    case 'keybase':
      icon = <Avatar size={32} username={result.username} style={iconStyle} />
      body = <KeybaseResultBody username={result.username} searchText={searchText} isFollowing={result.isFollowing} />
      break
    case 'external':
      icon = <Icon type={result.icon} style={iconStyle} />
      body = <ExternalResultBody username={result.username} searchText={searchText} />
      break
  }

  // Align the body to the middle of the original 32 row so the extra info doesn't push the username down
  const alignedBody = (
    <Box style={{flex: 1}}>
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
        <Box style={{height: 32, width: 0}} />
        {body}
      </Box>
    </Box>
  )

  let extraInfo = <Box />
  switch (result.extraInfo.service) {
    case 'external':
      extraInfo = <ExternalExtraInfo {...result.extraInfo} searchText={searchText} />
      break
    case 'keybase':
      extraInfo = <KeybaseExtraInfo {...result.extraInfo} searchText={searchText} />
      break
    case 'none':
      extraInfo = <Text type='BodyXSmall' style={{color: globalColors.black_40, alignSelf: 'center'}}>{result.extraInfo.fullName}</Text>
      break
  }

  const rowStyle = {
    ...globalStyles.clickable,
    height: 48,
    paddingTop: 8,
    paddingBottom: 8,
    paddingRight: 8,
    paddingLeft: 8,
    borderBottom: 'solid 1px',
    borderBottomColor: globalColors.black_10,
  }

  return (
    <ClickableBox onClick={() => onClickResult(result)} hoverColor={globalColors.blue4} style={rowStyle}>
      <Box style={{...globalStyles.flexBoxRow}}>
        {icon}
        {alignedBody}
        {extraInfo}
      </Box>
    </ClickableBox>
  )
}

function ServiceIcon ({serviceName, tooltip, iconType, selected, onClickService}: {serviceName: SearchPlatforms, tooltip: string, iconType: IconType, selected: boolean, onClickService: ServiceFn}) {
  const iconStyles = {
    borderRadius: 24,
    minWidth: 48,
    width: 48,
    height: 48,
    backgroundColor: selected ? globalColors.blue4 : null,
  }

  return (
    <IconButton
      tooltip={tooltip}
      tooltipPosition='top-center'
      style={iconStyles}
      onClick={() => onClickService(serviceName)}>
      <Icon type={iconType} />
    </IconButton>
  )
}

export type SearchBarProps = {
  selectedService: ?SearchPlatforms,
  onSearch: (term: string, platform?: ?SearchPlatforms) => void,
  searchText: ?string,
  searchHintText: string,
  onClickService: (service: SearchPlatforms) => void,
}

export class SearchBar extends Component<void, SearchBarProps, void> {
  _onDebouncedSearch: (overridePlatform?: SearchPlatforms) => void;

  constructor (props: SearchBarProps) {
    super(props)
    this._onDebouncedSearch = _.debounce(this._onSearch, 500)
  }

  componentWillReceiveProps (nextProps: SearchBarProps) {
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
    const services = ['Keybase', 'Twitter', 'Github', 'Coinbase', 'Reddit', 'Hackernews']
    const tooltips: {[key: string]: ?string} = {'Hackernews': 'Hacker News'}

    return (
      <Box>
        <Box style={stylesServicesContainer}>
          {services.map(s => (
            <ServiceIcon
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
            type='text'
            autoFocus
            ref='searchBox'
            onEnterKeyDown={() => this._onSearch()}
            onChange={() => this._onDebouncedSearch()}
            value={this.props.searchText}
            hintText={this.props.searchHintText}
            hintStyle={{textAlign: 'left', marginTop: 3}}
            underlineShow={false}
            style={stylesInput}
            textStyle={{height: 31}} />
          <Icon type='fa-kb-iconfont-remove' style={{marginRight: 16}} onClick={() => {
            this.refs.searchBox.clearValue()
            this._onSearch()
          }} />
        </Box>
      </Box>
    )
  }
}

export function searchResultsList ({results, searchText, onClickResult}: {results: Array<SearchResult>, searchText: ?string, onClickResult: SearchResultFn}) {
  return results.map(r => (
    <Result key={r.service + (r.icon ? r.icon : '') + r.username} result={r} searchText={searchText || ''} onClickResult={onClickResult} />
  ))
}

export class SearchContainer extends Component {
  render () {
    return (
      <Box style={stylesContainer}>
        {this.props.children}
      </Box>
    )
  }
}

export default class Render extends Component<void, Props, void> {
  render () {
    return (
      <SearchContainer>
        <SearchBar {...this.props} />
        <Box style={{overflowY: 'auto', flex: 1}}>
          {searchResultsList(this.props)}
        </Box>
      </SearchContainer>
    )
  }
}

const stylesContainer = {
  paddingTop: 48,
  flex: 1,
}
const stylesServicesContainer = {
  ...globalStyles.flexBoxRow,
  height: 48,
  paddingLeft: 16,
}
const stylesInputContainer = {
  ...globalStyles.flexBoxRow,
  height: 48,
  borderBottom: `solid 1px ${globalColors.black_10}`,
  alignItems: 'center',
  marginBottom: 8,
}
const stylesInput = {
  flex: 1,
  textAlign: 'left',
  marginLeft: 16,
  marginRight: 30,
}
