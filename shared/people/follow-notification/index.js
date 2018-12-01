// @flow
import React from 'react'
import PeopleItem from '../item'
import * as Types from '../../constants/types/people'
import {
  Avatar,
  Box,
  ClickableBox,
  ConnectedUsernames,
  Icon,
  Meta,
  ScrollView,
  Text,
} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins, platformStyles} from '../../styles'
import {isMobile} from '../../constants/platform'

const connectedUsernamesProps = {
  colorFollowing: true,
  inline: true,
  joinerStyle: {
    fontWeight: 'normal',
  },
  onUsernameClicked: 'profile',
  type: 'BodySemibold',
  underline: true,
}

export type NewFollow = Types.FollowedNotification

export type Props = Types.FollowedNotificationItem & {onClickUser: (username: string) => void}

// TODO remove this any type
export default (props: any) => {
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
    <ClickableBox onClick={() => props.onClickUser(username)}>
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
    </ClickableBox>
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
        <Box style={multiIconContainerStyle}>
          <Icon type={isMobile ? 'icon-followers-new-48' : 'icon-followers-new-32'} />
          <Box style={multiMetaContainerStyle}>
            <Meta
              title={`+${props.newFollows.length + (props.numAdditional || 0)}`}
              backgroundColor={globalColors.blue}
              style={multiMetaStyle}
            />
          </Box>
        </Box>
      }
      when={props.notificationTime}
    >
      <Text
        type="Body"
        style={platformStyles({
          common: {marginBottom: globalMargins.xtiny, marginTop: 2},
          isElectron: {display: 'inline'},
        })}
      >
        <ConnectedUsernames
          containerStyle={platformStyles({isElectron: {whiteSpace: 'wrap'}})}
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
        {...(isMobile ? {alwaysBounceHorizontal: false, horizontal: true} : {})} // Causes error on desktop
        contentContainerStyle={scrollViewContainerStyle}
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

const multiIconContainerStyle = {
  ...globalStyles.flexBoxColumn,
  height: isMobile ? 48 : 32,
  position: 'relative',
  width: isMobile ? 48 : 32,
}

const multiMetaContainerStyle = {
  ...globalStyles.flexBoxColumn,
  left: 0,
  position: 'absolute',
  right: 0,
  top: isMobile ? 30 : 20,
}

const multiMetaStyle = {
  alignSelf: 'center',
  minWidth: isMobile ? 24 : 16,
  ...(isMobile ? undefined : {textAlign: 'center'}),
}

const scrollViewContainerStyle = {
  ...globalStyles.flexBoxRow,
  ...(isMobile
    ? null
    : {...globalStyles.flexBoxRow, flexWrap: 'wrap', height: 32, overflow: 'hidden', width: '100%'}),
}
