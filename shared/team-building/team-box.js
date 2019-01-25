// @flow
import React from 'react'
import Input from './input'
import UserBubble from './user-bubble'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import type {ServiceIdWithContact} from '../constants/types/team-building'

type Props = {
  onChangeText: (newText: string) => void,
  onEnterKeyDown: () => void,
  onDownArrowKeyDown: () => void,
  onUpArrowKeyDown: () => void,
  teamSoFar: Array<{userId: string, prettyName: string, username: string, service: ServiceIdWithContact}>,
  onRemove: (userId: string) => void,
  onBackspace: () => void,
  searchString: string,
}

const formatNameForUserBubble = (username: string, service: ServiceIdWithContact, prettyName: ?string) => {
  const technicalName = service === 'keybase' ? username : `${username} on ${service}`
  return `${technicalName} ${prettyName ? `(${prettyName})` : ''}`
}

class UserBubbleCollection extends React.PureComponent<{
  teamSoFar: $PropertyType<Props, 'teamSoFar'>,
  onRemove: $PropertyType<Props, 'onRemove'>,
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

const TeamBox = (props: Props) => (
  <Kb.Box2 direction="horizontal" style={styles.container}>
    {Styles.isMobile && <Kb.Icon fontSize={22} type={'iconfont-search'} style={styles.searchIcon} />}
    <UserBubbleCollection teamSoFar={props.teamSoFar} onRemove={props.onRemove} />
    <Input
      onChangeText={props.onChangeText}
      onEnterKeyDown={props.onEnterKeyDown}
      onDownArrowKeyDown={props.onDownArrowKeyDown}
      onUpArrowKeyDown={props.onUpArrowKeyDown}
      onBackspace={props.onBackspace}
      searchString={props.searchString}
    />
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      flex: 1,
      flexWrap: 'wrap',
    },
    isElectron: {
      ...Styles.globalStyles.rounded,
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
      minHeight: 45,
    },
  }),
  searchIcon: {
    alignSelf: 'center',
    marginLeft: 10,
  },
})

export default TeamBox
