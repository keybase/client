// @flow
import * as React from 'react'
import * as Types from '../../constants/types/people'
import {List} from 'immutable'
import {Avatar, Box, ClickableBox, ScrollView, Text, ConnectedUsernames} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'
import {isMobile} from '../../constants/platform'

const connectedUsernamesProps = {
  clickable: true,
  colorFollowing: true,
  type: 'BodySemibold',
  style: {marginTop: globalMargins.xtiny, display: 'flex'},
}

export type FollowSuggestion = Types.FollowSuggestion

export type Props = {
  suggestions: List<FollowSuggestion>,
  onClickUser: (username: string) => void,
}

const Suggestion = (props: Types._FollowSuggestion & {onClickUser: () => void}) => (
  <ClickableBox
    style={{...globalStyles.flexBoxColumn, flexShrink: 0, width: 112, height: 106, alignItems: 'center'}}
    onClick={props.onClickUser}
  >
    <Avatar username={props.username} size={64} followsYou={props.followsMe} following={props.iFollow} />
    <ConnectedUsernames
      {...connectedUsernamesProps}
      usernames={[props.username]}
      onUsernameClicked={props.onClickUser}
      inline={true}
      containerStyle={{textAlign: 'center'}}
      style={{
        paddingLeft: 10,
        paddingRight: 10,
      }}
    />
    {!!props.fullName && (
      <Text type="BodySmall" lineClamp={1} style={{paddingLeft: 2, paddingRight: 2}}>
        {props.fullName}
      </Text>
    )}
  </ClickableBox>
)

export default (props: Props) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      position: 'relative',
      paddingTop: globalMargins.tiny,
      paddingLeft: 12,
      paddingRight: 12,
      paddingBottom: isMobile ? globalMargins.tiny : 106,
    }}
  >
    <Text type="BodySmallSemibold" style={{marginBottom: globalMargins.tiny}}>
      Consider following...
    </Text>
    <ScrollView
      {...(isMobile ? {horizontal: true} : {})} // Causes error on desktop
      contentContainerStyle={globalStyles.flexBoxRow}
      style={{
        ...globalStyles.flexBoxRow,
        overflow: 'scroll',
        ...(isMobile
          ? null
          : {
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
            }),
      }}
    >
      {props.suggestions.map(suggestion => (
        <Suggestion
          key={suggestion.username}
          {...suggestion.toObject()}
          onClickUser={() => props.onClickUser(suggestion.username)}
        />
      ))}
    </ScrollView>
  </Box>
)
