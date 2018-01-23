// @flow
import React from 'react'
import PeopleItem from '../item'
import * as Types from '../../constants/types/people'
import {Avatar, Box, ConnectedUsernames, Icon, Meta, ScrollView, Text} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {isMobile} from '../../constants/platform'

const connectedUsernamesProps = {
  clickable: true,
  inline: true,
  colorFollowing: true,
  type: 'BodySemibold',
  underline: true,
}

export type NewFollow = Types.FollowedNotification

export type Props = Types._FollowedNotificationItem & {onClickUser: (username: string) => void}

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
      icon={
        <Avatar username={username} onClick={() => props.onClickUser(username)} size={isMobile ? 48 : 32} />
      }
      when={props.notificationTime}
      contentStyle={{justifyContent: 'center'}}
    >
      <Text type="Body" style={{marginTop: 2}}>
        <ConnectedUsernames
          {...connectedUsernamesProps}
          usernames={[username]}
          onUsernameClicked={props.onClickUser}
        />{' '}
        followed you.
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
        <Box
          style={{
            ...globalStyles.flexBoxColumn,
            width: isMobile ? 48 : 32,
            height: isMobile ? 48 : 32,
            position: 'relative',
          }}
        >
          <Icon type={isMobile ? 'icon-followers-new-48' : 'icon-followers-new-32'} />
          <Box
            style={{
              ...globalStyles.flexBoxColumn,
              position: 'absolute',
              right: 0,
              left: 0,
              top: isMobile ? 30 : 20,
            }}
          >
            <Meta
              title={`+${props.newFollows.length + (props.numAdditional || 0)}`}
              style={{
                alignSelf: 'center',
                backgroundColor: globalColors.blue,
                minWidth: isMobile ? 24 : 16,
                textAlign: 'center',
              }}
            />
          </Box>
        </Box>
      }
      when={props.notificationTime}
    >
      <Text type="Body" style={{marginTop: 2, marginBottom: globalMargins.xtiny}}>
        <ConnectedUsernames
          containerStyle={{whiteSpace: 'wrap'}}
          inlineGrammar={true}
          showAnd={!props.numAdditional}
          {...connectedUsernamesProps}
          usernames={usernames}
          onUsernameClicked={props.onClickUser}
        />
        {!!props.numAdditional && props.numAdditional > 0 && ` and ${props.numAdditional} others `} started
        following you.
      </Text>
      <ScrollView
        {...(isMobile ? {horizontal: true, alwaysBounceHorizontal: false} : {})} // Causes error on desktop
        contentContainerStyle={{
          ...globalStyles.flexBoxRow,
          ...(isMobile
            ? null
            : {...globalStyles.flexBoxRow, width: '100%', height: 32, flexWrap: 'wrap', overflow: 'hidden'}),
        }}
      >
        {usernames.map(username => (
          <Avatar
            onClick={() => props.onClickUser(username)}
            username={username}
            size={32}
            key={username}
            style={{marginRight: globalMargins.xtiny}}
          />
        ))}
      </ScrollView>
    </PeopleItem>
  )
}
