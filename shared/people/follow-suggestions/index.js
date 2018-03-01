// @flow
import * as React from 'react'
import * as Types from '../../constants/types/people'
import {Avatar, Box, ClickableBox, ScrollView, Text, ConnectedUsernames} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'
import {isMobile} from '../../constants/platform'

const connectedUsernamesProps = {
  clickable: true,
  colorFollowing: true,
  type: 'BodySemibold',
  style: {marginTop: globalMargins.xtiny, display: 'flex'},
  underline: true,
}

export type FollowSuggestion = Types._FollowSuggestion

export type Props = {
  suggestions: Array<FollowSuggestion>,
  onClickUser: (username: string) => void,
}

const Suggestion = (props: Types._FollowSuggestion & {onClickUser: () => void}) => (
  <ClickableBox style={suggestionContainerStyle} onClick={props.onClickUser}>
    <Avatar
      username={props.username}
      size={64}
      followsYou={props.followsMe}
      following={props.iFollow}
      style={{marginBottom: globalMargins.xtiny}}
    />
    <ConnectedUsernames
      {...connectedUsernamesProps}
      {...connectedUsernamesStyles}
      usernames={[props.username]}
      onUsernameClicked={props.onClickUser}
      inline={true}
    />
    {!!props.fullName && (
      <Text type="BodySmall" lineClamp={1} style={fullnameStyle}>
        {props.fullName}
      </Text>
    )}
  </ClickableBox>
)

export default (props: Props) => (
  <Box style={containerStyle}>
    <Text type="BodySmallSemibold" style={{marginBottom: globalMargins.tiny, marginLeft: globalMargins.tiny}}>
      Consider following...
    </Text>
    <ScrollView
      {...(isMobile ? {horizontal: true, alwaysBounceHorizontal: false} : {})} // Causes error on desktop
      contentContainerStyle={scrollViewContainerStyle}
    >
      {props.suggestions.map(suggestion => (
        <Suggestion
          key={suggestion.username}
          {...suggestion}
          onClickUser={() => props.onClickUser(suggestion.username)}
        />
      ))}
    </ScrollView>
  </Box>
)

const suggestionContainerStyle = {
  ...globalStyles.flexBoxColumn,
  flexShrink: 0,
  width: 112,
  height: 106,
  alignItems: 'center',
}

const connectedUsernamesStyles = {
  containerStyle: isMobile ? undefined : {textAlign: 'center'},
  style: {
    paddingLeft: globalMargins.tiny,
    paddingRight: globalMargins.tiny,
  },
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  position: 'relative',
  paddingTop: globalMargins.tiny,
  paddingBottom: globalMargins.tiny,
}

const scrollViewContainerStyle = {
  ...globalStyles.flexBoxRow,
  ...(isMobile
    ? null
    : {...globalStyles.flexBoxRow, width: '100%', height: 106, flexWrap: 'wrap', overflow: 'hidden'}),
}

const fullnameStyle = {
  paddingLeft: 1,
  paddingRight: 2,
  ...(isMobile
    ? null
    : {
        width: '90%',
        whiteSpace: 'nowrap',
        display: 'unset',
        textAlign: 'center',
      }),
}
