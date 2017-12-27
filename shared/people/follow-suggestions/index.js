// @flow
import * as React from 'react'
import {Avatar, Box, Text, ConnectedUsernames} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'

const connectedUsernamesProps = {
  clickable: true,
  colorFollowing: true,
  type: 'BodySemibold',
  style: {marginTop: globalMargins.xtiny, display: 'block'},
}

export type FollowSuggestion = {
  username: string,
  fullName: ?string,
  followsMe: boolean,
  iFollow: boolean,
}

export type Props = {
  suggestions: Array<FollowSuggestion>,
  onClickUser: (username: string) => void,
}

const Suggestion = (props: FollowSuggestion & {onClickUser: () => void}) => (
  <Box style={{...globalStyles.flexBoxColumn, flexShrink: 0, width: 112, height: 106, alignItems: 'center'}}>
    <Avatar
      onClick={props.onClickUser}
      username={props.username}
      size={64}
      followsYou={props.followsMe}
      following={props.iFollow}
    />
    <ConnectedUsernames
      {...connectedUsernamesProps}
      usernames={[props.username]}
      onUsernameClicked={props.onClickUser}
    />
    {!!props.fullName && <Text type="BodySmall">{props.fullName}</Text>}
  </Box>
)

export default (props: Props) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      width: '100%',
      position: 'relative',
      paddingTop: globalMargins.tiny,
      paddingLeft: 12,
      paddingBottom: globalMargins.tiny,
    }}
  >
    <Text type="BodySmallSemibold" style={{marginBottom: globalMargins.tiny}}>
      Consider following...
    </Text>
    <Box style={{...globalStyles.flexBoxRow, overflow: 'auto'}}>
      {props.suggestions.map(suggestion => (
        <Suggestion
          key={suggestion.username}
          {...suggestion}
          onClickUser={() => props.onClickUser(suggestion.username)}
        />
      ))}
    </Box>
  </Box>
)
