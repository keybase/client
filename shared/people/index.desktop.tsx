import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import {PeoplePageList} from './index.shared'
import {Props} from '.'
import ProfileSearch from '../profile/search/bar-container'

export const Header = (_: Props) => (
  <Kb.Box2 direction="horizontal" style={styles.header}>
    <ProfileSearch />
  </Kb.Box2>
)

const People = (props: Props) => (
  <Kb.ScrollView style={styles.container}>
    {props.waiting && <Kb.ProgressIndicator style={styles.progress} />}
    <PeoplePageList {...props} />
  </Kb.ScrollView>
)

const styles = Styles.styleSheetCreate(() => ({
  container: {...Styles.globalStyles.fullHeight},
  header: {flexGrow: 1},
  progress: {
    height: 18,
    left: 40,
    position: 'absolute',
    top: 9,
    width: 18,
  },
  searchContainer: {paddingBottom: Styles.globalMargins.xsmall},
  sectionTitle: {flexGrow: 1},
}))

export default People
