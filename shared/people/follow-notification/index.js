// @flow
import React from 'react'
import PeopleItem from '../item'
import {Avatar, Box, ConnectedUsernames, Icon, Meta, Text} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'

const connectedUsernamesProps = {
  clickable: true,
  inline: true,
  colorFollowing: true,
  type: 'BodySemibold',
}

export type NewFollow = {
  username: string,
}

export type Props = {
  newFollows: Array<NewFollow>,
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
      icon={<Avatar username={username} size={32} />}
      when={props.notificationTime}
    >
      <Text type="Body" style={{marginTop: 2}}>
        <ConnectedUsernames {...connectedUsernamesProps} usernames={[username]} />
        {' '}
        followed you.
      </Text>
    </PeopleItem>
  )
}

export const MultiFollowNotification = (props: Props) => {
  if (props.newFollows.length <= 1) {
    throw new Error('Multi follow notification must have more than one user supplied')
  }
  return (
    <PeopleItem
      badged={props.badged}
      icon={
        <Box style={{...globalStyles.flexBoxColumn, width: 32, height: 32}}>
          <Icon type="icon-followers-new-32" />
          <Meta
            title={`+${props.newFollows.length}`}
            style={{
              backgroundColor: globalColors.blue,
              marginTop: -12,
              marginLeft: 'auto',
              marginRight: 'auto',
              fontSize: 11,
              paddingTop: 1,
            }}
          />
        </Box>
      }
    >
      <Text type="Body" style={{marginTop: 2}}>
        <ConnectedUsernames {...connectedUsernamesProps} usernames={[props.newFollows[0].username]} />
      </Text>
    </PeopleItem>
  )
}
