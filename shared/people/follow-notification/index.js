// @flow
import React from 'react'
import PeopleItem from '../item'
import {Avatar, Box, ConnectedUsernames, Icon, Meta, Text} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {isMobile} from '../../constants/platform'

const connectedUsernamesProps = {
  clickable: true,
  inline: true,
  colorFollowing: true,
  type: 'Body',
}

export type NewFollow = {
  username: string,
}

export type Props = {
  newFollows: Array<NewFollow>,
  numAdditional?: number,
  badged: boolean,
  notificationTime: Date,
}

export default (props: Props) => {
  if (props.newFollows.length === 1) {
    return <FollowNotification {...props} />
  }
  return <MultiFollowNotification {...props} />
}

export const FollowNotification = (props: Props) => {
  if (props.newFollows.length !== 1) {
    throw new Error('Single follow notification must have exactly one user supplied')
  }
  const username = props.newFollows[0].username
  return (
    <PeopleItem
      badged={props.badged}
      icon={<Avatar username={username} size={isMobile ? 48 : 32} />}
      when={props.notificationTime}
    >
      <Text type="Body" style={{marginTop: 2}}>
        <ConnectedUsernames {...connectedUsernamesProps} usernames={[username]} /> followed you.
      </Text>
    </PeopleItem>
  )
}

export const MultiFollowNotification = (props: Props) => {
  if (props.newFollows.length <= 1) {
    throw new Error('Multi follow notification must have more than one user supplied')
  }
  const usernames = props.newFollows.map(f => f.username)
  return (
    <PeopleItem
      badged={props.badged}
      icon={
        <Box style={{...globalStyles.flexBoxColumn, width: 32, height: 32}}>
          <Icon type={isMobile ? 'icon-followers-new-48' : 'icon-followers-new-32'} />
          <Meta
            title={`+${props.newFollows.length + (props.numAdditional || 0)}`}
            style={{
              backgroundColor: globalColors.blue_60,
              marginTop: -12,
              marginLeft: 'auto',
              marginRight: 'auto',
              fontSize: 11,
              paddingTop: 1,
            }}
          />
        </Box>
      }
      when={props.notificationTime}
      contentStyle={{paddingBottom: 32}}
    >
      <Text type="Body" style={{marginTop: 2, marginBottom: globalMargins.xtiny}}>
        <ConnectedUsernames
          containerStyle={{whiteSpace: 'wrap'}}
          inlineGrammar={true}
          showAnd={!props.numAdditional}
          {...connectedUsernamesProps}
          usernames={usernames}
        />
        {!!props.numAdditional && props.numAdditional > 0 && ` and ${props.numAdditional} others `} started
        following you.
      </Text>
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          overflow: 'scroll',
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
        }}
      >
        {usernames.map(username => (
          <Avatar username={username} size={32} key={username} style={{marginRight: globalMargins.xtiny}} />
        ))}
      </Box>
    </PeopleItem>
  )
}
