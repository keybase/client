// @flow
import React from 'react'
import PeopleItem from '../item'
import {ConnectedUsernames, Text} from '../../common-adapters'

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
}

export default (props: Props) => {
  if (props.newFollows.length === 1) {
    return <FollowNotification {...props} />
  }
  return <MultiFollowNotification {...props} />
}

export const FollowNotification = (props: Props) => {
  if (props.newFollows.length !== 1) {
    throw new Error('Follow notification must have exactly one user supplied')
  }
  return (
    <PeopleItem badged={props.badged} icon="icon-onboarding-git-32">
      <Text type="Body" style={{marginTop: 2, paddingRight: 40}}>
        <ConnectedUsernames {...connectedUsernamesProps} usernames={[props.newFollows[0].username]} />
        {' '}
        followed you.
      </Text>
    </PeopleItem>
  )
}

export const MultiFollowNotification = (props: Props) => {
  if (props.newFollows.length !== 1) {
    throw new Error('Follow notification must have exactly one user supplied')
  }
  return (
    <PeopleItem badged={props.badged} icon="icon-onboarding-git-32">
      <Text type="Body" style={{marginTop: 2, paddingRight: 40}}>
        <ConnectedUsernames {...connectedUsernamesProps} usernames={[props.newFollows[0].username]} />
      </Text>
    </PeopleItem>
  )
}
