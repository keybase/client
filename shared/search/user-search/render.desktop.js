// @flow
import React, {Component} from 'react'

import {Avatar, Box, ClickableBox, Icon, Text, ProgressIndicator} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'

import type {SearchResult} from '../../constants/search'
import type {Props, SearchResultFn} from './render'

function KeybaseResultBody({username, searchText, isFollowing}) {
  return (
    <Text type="BodySemibold" style={{color: isFollowing ? globalColors.green2 : globalColors.blue}}>
      {username}
    </Text>
  )
}

function ExternalResultBody({username, searchText}) {
  return <Text type="BodySemibold" style={{color: globalColors.black_75}}>{username}</Text>
}

function KeybaseExtraInfo({username, fullName, isFollowing, searchText}) {
  return (
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'flex-end', justifyContent: 'center'}}>
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
        <Avatar size={16} style={{width: 16, marginRight: 4}} username={username} />
        <Text type="BodySmallSemibold" style={{color: isFollowing ? globalColors.green2 : globalColors.blue}}>
          {username}
        </Text>
      </Box>
      {!!fullName &&
        <Text type="BodySmall" style={{...fullNameStyle, color: globalColors.black_40}}>{fullName}</Text>}
    </Box>
  )
}

function ExternalExtraInfo({fullNameOnService, icon, serviceAvatar, serviceUsername, searchText}) {
  return (
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'flex-end', justifyContent: 'center'}}>
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
        {!!icon && <Icon type={icon} style={{width: 17, marginRight: 4}} />}
        {!icon && <Avatar size={16} url={serviceAvatar} style={{marginRight: 4}} />}
        {!!serviceUsername && <Text type="BodySmallSemibold">{serviceUsername}</Text>}
      </Box>
      {!!fullNameOnService &&
        <Text type="BodySmall" style={{...fullNameStyle, color: globalColors.black_40}}>
          {fullNameOnService}
        </Text>}
    </Box>
  )
}

export function Result({
  result,
  searchText,
  onClickResult,
}: {
  result: SearchResult,
  searchText: string,
  onClickResult: SearchResultFn,
}) {
  const iconStyle = {height: 32, width: 32, marginRight: 16}

  let icon
  let body = <Box />
  switch (result.service) {
    case 'keybase':
      icon = <Avatar size={32} username={result.username} style={iconStyle} />
      body = (
        <KeybaseResultBody
          username={result.username}
          searchText={searchText}
          isFollowing={result.isFollowing}
        />
      )
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
      extraInfo = (
        <Text type="BodySmall" style={{...fullNameStyle, color: globalColors.black_40, alignSelf: 'center'}}>
          {result.extraInfo.fullName}
        </Text>
      )
      break
  }

  const rowStyle = {
    ...globalStyles.clickable,
    height: 48,
    paddingTop: 8,
    paddingBottom: 8,
    paddingRight: 8,
    paddingLeft: 8,
    borderTop: 'solid 1px',
    borderTopColor: globalColors.black_10,
    width: '100%',
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

class UserSearchRender extends Component<void, Props, void> {
  render() {
    return (
      <Box style={{flex: 1, position: 'relative', minHeight: 40}}>
        {this.props.waiting &&
          <ProgressIndicator
            white={false}
            style={{
              position: 'absolute',
              width: 20,
              top: 0,
              left: 0,
              right: 0,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          />}
        {this.props.results.map(r => (
          <Result
            key={r.service + (r.icon ? r.icon : '') + r.username}
            result={r}
            searchText={this.props.searchText || ''}
            onClickResult={this.props.onClickResult}
          />
        ))}
      </Box>
    )
  }
}

const fullNameStyle = {
  whiteSpace: 'nowrap',
  width: 130,
  textOverflow: 'ellipsis',
  overflow: 'auto',
  textAlign: 'right',
}

export default UserSearchRender
