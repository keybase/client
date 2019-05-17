import * as React from 'react'
import GoButton from './go-button'
import Input from './input'
import UserBubble from './user-bubble'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import {ServiceIdWithContact} from '../constants/types/team-building'

type Props = {
  onChangeText: (newText: string) => void
  onEnterKeyDown: () => void
  onDownArrowKeyDown: () => void
  onUpArrowKeyDown: () => void
  teamSoFar: Array<{
    userId: string
    prettyName: string
    username: string
    service: ServiceIdWithContact
  }>
  onRemove: (userId: string) => void
  onBackspace: () => void
  onFinishTeamBuilding: () => void
  searchString: string
}

const formatNameForUserBubble = (
  username: string,
  service: ServiceIdWithContact,
  prettyName: string | null
) => {
  const technicalName = service === 'keybase' ? username : `${username} on ${service}`
  return `${technicalName} ${prettyName ? `(${prettyName})` : ''}`
}

class UserBubbleCollection extends React.PureComponent<{
  teamSoFar: Props['teamSoFar']
  onRemove: Props['onRemove']
}> {
  render() {
    return this.props.teamSoFar.map(u => (
      <UserBubble
        key={u.userId}
        onRemove={() => this.props.onRemove(u.userId)}
        username={u.username}
        service={u.service}
        prettyName={formatNameForUserBubble(u.username, u.service, u.prettyName)}
      />
    ))
  }
}

const TeamInput = (props: Props) => (
  <Input
    hasMembers={!!props.teamSoFar.length}
    onChangeText={props.onChangeText}
    onEnterKeyDown={props.onEnterKeyDown}
    onDownArrowKeyDown={props.onDownArrowKeyDown}
    onUpArrowKeyDown={props.onUpArrowKeyDown}
    onBackspace={props.onBackspace}
    placeholder={props.teamSoFar.length ? 'Add another username or enter to chat' : 'Enter a username'}
    searchString={props.searchString}
  />
)

const TeamBox = (props: Props) =>
  (Styles.isMobile && (
    <Kb.Box2 direction="horizontal" style={styles.container}>
      <UserBubbleCollection teamSoFar={props.teamSoFar} onRemove={props.onRemove} />
      <TeamInput {...props} />
    </Kb.Box2>
  )) || (
    <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true}>
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        <Kb.Box2 direction="horizontal" style={styles.search}>
          <TeamInput {...props} />
        </Kb.Box2>
        {!!props.teamSoFar.length && <GoButton onClick={props.onFinishTeamBuilding} />}
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.bubbles}>
        <Kb.ScrollView horizontal={true}>
          <Kb.Box2 direction="horizontal" fullHeight={true} style={styles.floatingBubbles}>
            <UserBubbleCollection teamSoFar={props.teamSoFar} onRemove={props.onRemove} />
          </Kb.Box2>
        </Kb.ScrollView>
      </Kb.Box2>
    </Kb.Box2>
  )

const styles = Styles.styleSheetCreate({
  bubbles: Styles.platformStyles({
    isElectron: {
      overflow: 'hidden',
      paddingBottom: Styles.globalMargins.xsmall,
      paddingTop: Styles.globalMargins.xsmall,
    },
  }),
  container: Styles.platformStyles({
    common: {
      flexWrap: 'wrap',
    },
    isElectron: {
      backgroundColor: Styles.globalColors.blueGrey,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
      paddingTop: Styles.globalMargins.small,
    },
    isMobile: {
      borderBottomColor: Styles.globalColors.black_10,
      borderBottomWidth: 1,
      borderStyle: 'solid',
      flex: 1,
      minHeight: 48,
    },
  }),
  floatingBubbles: Styles.platformStyles({
    isElectron: {
      justifyContent: 'flex-end',
    },
  }),
  search: Styles.platformStyles({
    common: {
      flex: 1,
      flexWrap: 'wrap',
    },
    isElectron: {
      ...Styles.globalStyles.rounded,
      backgroundColor: Styles.globalColors.white,
      borderColor: Styles.globalColors.black_20,
      borderStyle: 'solid',
      borderWidth: 1,
      maxHeight: 170,
      minHeight: 40,
      overflowY: 'scroll',
    },
    isMobile: {
      borderBottomColor: Styles.globalColors.black_10,
      borderBottomWidth: 1,
      borderStyle: 'solid',
      minHeight: 48,
    },
  }),
  searchIcon: {
    alignSelf: 'center',
    marginLeft: 10,
  },
})

export default TeamBox
