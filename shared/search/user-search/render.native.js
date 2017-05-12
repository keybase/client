// @flow
import React from 'react'
import {
  Avatar,
  Box,
  Icon,
  Text,
  ListItem,
  NativeScrollView,
  ProgressIndicator,
} from '../../common-adapters/index.native'
import {globalStyles, globalColors} from '../../styles'

import type {Props} from './render'
import type {SearchResult} from '../../constants/search'

const KeybaseResultBody = ({username, searchText, isFollowing}) => (
  <Text
    type="BodySemibold"
    style={{color: isFollowing ? globalColors.green2 : globalColors.blue}}
  >
    {username}
  </Text>
)

const ExternalResultBody = ({username, searchText}) => (
  <Text type="BodySemibold" style={{color: globalColors.black_75}}>
    {username}
  </Text>
)

const KeybaseExtraInfo = ({username, fullName, isFollowing, searchText}) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      alignItems: 'flex-end',
      justifyContent: 'center',
    }}
  >
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
      <Avatar
        size={16}
        style={{width: 16, marginRight: 4}}
        username={username}
      />
      <Text
        type="BodySmallSemibold"
        style={{color: isFollowing ? globalColors.green2 : globalColors.blue}}
      >
        {username}
      </Text>
    </Box>
    {!!fullName &&
      <Text type="BodySmall" style={{color: globalColors.black_40}}>
        {fullName}
      </Text>}
  </Box>
)

const ExternalExtraInfo = ({
  fullNameOnService,
  icon,
  serviceAvatar,
  serviceUsername,
  searchText,
}) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      alignItems: 'flex-end',
      justifyContent: 'center',
    }}
  >
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
      {!!icon && <Icon type={icon} style={{width: 17, marginRight: 4}} />}
      {!icon &&
        <Avatar size={16} url={serviceAvatar} style={{marginRight: 4}} />}
      {!!serviceUsername &&
        <Text type="BodySmallSemibold">{serviceUsername}</Text>}
    </Box>
    {!!fullNameOnService &&
      <Text type="BodySmall" style={{color: globalColors.black_40}}>
        {fullNameOnService}
      </Text>}
  </Box>
)

function Result({
  result,
  searchText,
  onClickResult,
}: {
  result: SearchResult,
  searchText: string,
  onClickResult: () => void,
}) {
  const iconStyle = {height: 32, width: 32}

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
      body = (
        <ExternalResultBody
          username={result.username}
          searchText={searchText}
        />
      )
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
      extraInfo = (
        <ExternalExtraInfo {...result.extraInfo} searchText={searchText} />
      )
      break
    case 'keybase':
      extraInfo = (
        <KeybaseExtraInfo {...result.extraInfo} searchText={searchText} />
      )
      break
    case 'none':
      extraInfo = (
        <Text
          type="BodySmall"
          style={{color: globalColors.black_40, alignSelf: 'center'}}
        >
          {result.extraInfo.fullName}
        </Text>
      )
      break
  }

  return (
    <ListItem
      type="Small"
      icon={icon}
      body={
        <Box style={{...globalStyles.flexBoxRow}}>{alignedBody}{extraInfo}</Box>
      }
      action={<Box />}
      onClick={onClickResult}
      bodyContainerStyle={{marginBottom: 0, marginTop: 0, marginRight: 0}}
    />
  )
}

const UserSearchRender = ({
  results,
  onClickResult,
  searchText,
  waiting,
}: Props) => (
  <NativeScrollView style={{...globalStyles.flexBoxColumn, flex: 1}}>
    {!!waiting && <ProgressIndicator white={false} />}
    {results.map(r => (
      <Result
        key={r.service + (r.icon || '') + r.username}
        result={r}
        onClickResult={() => onClickResult(r)}
        searchText={searchText || ''}
      />
    ))}
  </NativeScrollView>
)

export default UserSearchRender
