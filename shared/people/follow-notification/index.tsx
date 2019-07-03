import * as React from 'react'
import PeopleItem from '../item'
import * as Types from '../../constants/types/people'
import {Avatar, ClickableBox, ConnectedUsernames, ScrollView, Text, WithTooltip} from '../../common-adapters'
import * as Styles from '../../styles'

const connectedUsernamesProps = {
  colorFollowing: true,
  inline: true,
  joinerStyle: {
    fontWeight: 'normal',
  },
  onUsernameClicked: 'profile',
  type: 'BodySemibold',
  underline: true,
} as const

export type NewFollow = Types.FollowedNotification

export type Props = Types.FollowedNotificationItem & {
  onClickUser: (username: string) => void
}

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
          <Avatar
            username={username}
            onClick={() => props.onClickUser(username)}
            size={Styles.isMobile ? 48 : 32}
          />
        }
        when={props.notificationTime}
        contentStyle={{justifyContent: 'center'}}
        format="single"
      >
        <Text type="Body">
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
    <PeopleItem format="multi" badged={props.badged} when={props.notificationTime}>
      <Text type="Body" style={multiTextStyle}>
        <ConnectedUsernames
          containerStyle={Styles.platformStyles({isElectron: {whiteSpace: 'wrap'}})}
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
        {...(Styles.isMobile ? {alwaysBounceHorizontal: false, horizontal: true} : {})} // Causes error on desktop
        contentContainerStyle={scrollViewContainerStyle}
      >
        {usernames.map(username => (
          <WithTooltip key={username} text={username}>
            <Avatar
              onClick={() => props.onClickUser(username)}
              username={username}
              size={32}
              style={{marginRight: Styles.globalMargins.xtiny}}
            />
          </WithTooltip>
        ))}
      </ScrollView>
    </PeopleItem>
  )
}

const multiTextStyle = Styles.platformStyles({
  common: {
    marginLeft: Styles.globalMargins.small,
    marginRight: Styles.globalMargins.xlarge,
    marginTop: 2,
  },
  isElectron: {display: 'inline'},
})

const scrollViewContainerStyle = {
  ...Styles.globalStyles.flexBoxRow,
  paddingBottom: Styles.globalMargins.tiny,
  paddingLeft: Styles.globalMargins.small,
  paddingRight: Styles.globalMargins.small,
  ...(Styles.isMobile
    ? null
    : ({
        ...Styles.globalStyles.flexBoxRow,
        flexWrap: 'wrap',
        height: 32,
        overflow: 'hidden',
        width: '100%',
      } as const)),
}
