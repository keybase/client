// @flow
import React, {Component} from 'react'

import {Avatar, Box, ClickableBox, Icon, Text} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles/style-guide'

import type {SearchResult} from '../../constants/search'
import type {Props, SearchResultFn} from './render'
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

class Render extends Component<void, Props, void> {
  render () {
    return (
      <Box style={{overflowY: 'auto', flex: 1, position: 'relative', minHeight: 40}}>
        {this.props.waiting && <Icon type='icon-progress-grey-animated'
          style={{position: 'absolute', width: 20, top: 0, left: 0, right: 0, marginLeft: 'auto', marginRight: 'auto'}} />}
        {this.props.results.map(r => (
          <Result key={r.service + (r.icon ? r.icon : '') + r.username} result={r}
            searchText={this.props.searchText || ''} onClickResult={this.props.onClickResult} />))}
      </Box>
    )
  }
}

export default Render
