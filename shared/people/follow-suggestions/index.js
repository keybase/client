// @flow
import * as React from 'react'
import * as Types from '../../constants/types/people'
import {List} from 'immutable'
import {Avatar, Box, Text, ConnectedUsernames} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'

const connectedUsernamesProps = {
  clickable: true,
  colorFollowing: true,
  type: 'BodySemibold',
  style: {marginTop: globalMargins.xtiny, display: 'block'},
}

export type FollowSuggestion = Types.FollowSuggestion

export type Props = {
  suggestions: List<FollowSuggestion>,
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
      position: 'relative',
      paddingTop: globalMargins.tiny,
      paddingLeft: 12,
      paddingRight: 12,
      paddingBottom: 106,
    }}
  >
    <Text type="BodySmallSemibold" style={{marginBottom: globalMargins.tiny}}>
      Consider following...
    </Text>
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        overflow: 'auto',
        width: '100%',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
      }}
    >
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
