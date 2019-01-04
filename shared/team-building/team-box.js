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

const TeamBox = (props: Props) => (
  <Kb.Box2 direction="horizontal" style={styles.container}>
    {Styles.isMobile && <Kb.Icon fontSize={22} type={'iconfont-search'} style={styles.searchIcon} />}
    {props.teamSoFar.map(u => (
      <UserBubble
        key={u.userId}
        onRemove={() => props.onRemove(u.userId)}
        username={u.username}
        service={u.service}
        prettyName={u.prettyName}
      />
    ))}
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
      ...Styles.globalStyles.rounded,
      borderColor: Styles.globalColors.black_20,
      borderStyle: 'solid',
      borderWidth: 1,
      flex: 1,
    },
    isElectron: {
      height: 40,
    },
    isMobile: {
      height: 45,
    },
  }),
  searchIcon: {
    alignSelf: 'center',
    marginLeft: 10,
  },
})

export default TeamBox
