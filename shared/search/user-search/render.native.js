// @flow
import React, {Component} from 'react'
import {Avatar, Box, Icon, Input, Text, ListItem} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'

import type {Props} from './render'
import type {SearchResult} from '../../constants/search'

function KeybaseResultBody ({username, searchText, isFollowing}) {
  return <Text type='Body'
    style={{color: isFollowing ? globalColors.green2 : globalColors.orange}}>{username}</Text>
}

function ExternalResultBody ({username, searchText}) {
  return <Text type='Body'
    style={{color: globalColors.black_75}}>{username}</Text>
}

function KeybaseExtraInfo ({username, fullName, isFollowing, searchText}) {
  return (
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'flex-end', justifyContent: 'center'}}>
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
        <Avatar size={16} style={{width: 16, marginRight: 4}} username={username} />
        <Text type='BodySmall'
          style={{color: isFollowing ? globalColors.green2 : globalColors.orange}}>{username}</Text>
      </Box>
      {!!fullName && <Text type='BodyXSmall' style={{color: globalColors.black_40}}>{fullName}</Text>}
    </Box>
  )
}

function ExternalExtraInfo ({fullNameOnService, icon, serviceAvatar, serviceUsername, searchText}) {
  return (
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'flex-end', justifyContent: 'center'}}>
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
        {!!icon && <Icon type={icon} style={{width: 17, marginRight: 4}} />}
        {!icon && <Avatar size={16} url={serviceAvatar} style={{marginRight: 4}} />}
        {!!serviceUsername && <Text type='BodySmall'>{serviceUsername}</Text>}
      </Box>
      {!!fullNameOnService && <Text type='BodyXSmall' style={{color: globalColors.black_40}}>{fullNameOnService}</Text>}
    </Box>
  )
}

function Result ({result, searchText, onClickResult}: {result: SearchResult, searchText: string, onClickResult: () => void}) {
  const iconStyle = {height: 32, width: 32}

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

  return (
    <ListItem
      type='Small'
      icon={icon}
      body={<Box style={{...globalStyles.flexBoxRow}}>{alignedBody}{extraInfo}</Box>}
      action={<Box />}
      onClick={onClickResult}
      bodyContainerStyle={{marginBottom: 0, marginTop: 0}}
      />
  )
}

export default class Render extends Component<void, Props, void> {
  render () {
    return (
      <Box style={globalStyles.flexBoxColumn}>
        <ListItem
          type='Small'
          containerStyle={{backgroundColor: globalColors.blue4}}
          icon={<Icon type={this.props.searchIcon} style={{width: 32, height: 32}} />}
          body={(
            <Box style={{flex: 2, height: 32}}>
              <Input type='text' autoCapitalize='none' value={this.props.searchText} hintText={this.props.searchHintText} iosOmitUnderline={true} style={{marginTop: 0, height: 32}} onChangeText={text => this.props.onSearch(text)} />
            </Box>
          )}
          action={<Box />} />
        {this.props.results.map(r => <Result key={r.service + (r.icon || '') + r.username} result={r} onClickResult={() => this.props.onClickResult(r)} searchText={this.props.searchText || ''} />)}
      </Box>
    )
  }
}
