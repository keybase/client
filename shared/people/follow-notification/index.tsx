import * as React from 'react'
import PeopleItem from '../item'
import * as Types from '../../constants/types/people'
import * as Kb from '../../common-adapters'
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

const FollowNotification = (props: Props) => {
  if (props.newFollows.length !== 1) {
    throw new Error('Single follow notification must have exactly one user supplied')
  }
  const username = props.newFollows[0].username
  return (
    <Kb.ClickableBox onClick={() => props.onClickUser(username)}>
      <PeopleItem
        badged={props.badged}
        icon={
          <Kb.Avatar
            username={username}
            onClick={() => props.onClickUser(username)}
            size={Styles.isMobile ? 48 : 32}
          />
        }
        iconContainerStyle={styles.iconContainer}
        when={props.notificationTime}
        contentStyle={styles.peopleItem}
        format="single"
      >
        <Kb.Text type="Body">
          <Kb.ConnectedUsernames
            {...connectedUsernamesProps}
            usernames={[username]}
            onUsernameClicked={props.onClickUser}
          />{' '}
          followed you.
        </Kb.Text>
      </PeopleItem>
    </Kb.ClickableBox>
  )
}

export const MultiFollowNotification = (props: Props) => {
  if (props.newFollows.length <= 1) {
    throw new Error('Multi follow notification must have more than one user supplied')
  }
  const usernames = props.newFollows.map(f => f.username)
  return (
    <PeopleItem format="multi" badged={props.badged} when={props.notificationTime}>
      <Kb.Text type="Body" style={styles.multiText}>
        <Kb.ConnectedUsernames
          containerStyle={styles.usernames}
          inlineGrammar={true}
          showAnd={!props.numAdditional}
          {...connectedUsernamesProps}
          usernames={usernames}
          onUsernameClicked={props.onClickUser}
        />
        {!!props.numAdditional && props.numAdditional > 0 && ` and ${props.numAdditional} others `} started
        following you.
      </Kb.Text>
      <Kb.ScrollView
        {...(Styles.isMobile ? {alwaysBounceHorizontal: false, horizontal: true} : {})} // Causes error on desktop
        contentContainerStyle={styles.scrollViewContainer}
      >
        {usernames.map(username => (
          <Kb.WithTooltip key={username} text={username}>
            <Kb.Avatar
              onClick={() => props.onClickUser(username)}
              username={username}
              size={32}
              style={styles.avatar}
            />
          </Kb.WithTooltip>
        ))}
      </Kb.ScrollView>
    </PeopleItem>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  avatar: {marginRight: Styles.globalMargins.xtiny},
  iconContainer: {width: 'auto'},
  multiText: Styles.platformStyles({
    common: {
      marginLeft: Styles.globalMargins.small,
      marginRight: Styles.globalMargins.xlarge,
      marginTop: 2,
    },
    isElectron: {display: 'inline'},
  }),
  peopleItem: {justifyContent: 'center'},
  scrollViewContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      paddingBottom: Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
    isMobile: {
      ...Styles.globalStyles.flexBoxRow,
      flexWrap: 'wrap',
      height: 32,
      overflow: 'hidden',
      width: '100%',
    },
  }),
  usernames: Styles.platformStyles({isElectron: {whiteSpace: 'wrap'}}),
}))
