// @flow
import React, {Component} from 'react'
import {Avatar, Box, Icon, Input, Text, ListItem} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles/style-guide'

import type {Props} from './render'
import type {SearchResult} from '../../constants/search'
import type {Props as TextProps} from '../../common-adapters/text'

function EmboldenTextMatch ({text, match, style, textType, emboldenStyle}: {text: string, match: string, emboldenStyle?: Object, style?: Object, textType: TextProps.type}) {
  const indexOfMatch = text.indexOf(match)
  if (indexOfMatch > -1) {
    const left = text.substring(0, indexOfMatch)
    const middle = text.substring(indexOfMatch, indexOfMatch + match.length)
    const right = text.substring(indexOfMatch + match.length)
    return (
      <Box style={globalStyles.flexBoxRow}>
        {!!left && <Text type={textType} style={style}>{left}</Text>}
        <Text type={textType} style={{...globalStyles.fontBold, ...style, ...emboldenStyle}}>{middle}</Text>
        {!!right && <EmboldenTextMatch style={style} text={right} match={match} textType={textType} emboldenStyle={emboldenStyle} />}
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
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'flex-end', justifyContent: 'center'}}>
      <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
        <Avatar size={16} style={{width: 16, marginRight: 4}} username={username} />
        <EmboldenTextMatch text={username} match={searchText} textType={'BodySmall'} style={{color: isFollowing ? globalColors.green2 : globalColors.orange}} />
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
        {!!serviceUsername && <EmboldenTextMatch text={serviceUsername} match={searchText} textType={'BodySmall'} emboldenStyle={{color: globalColors.black_75}} />}
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
