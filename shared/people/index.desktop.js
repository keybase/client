// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import {PeoplePageSearchBar, PeoplePageList} from './index.shared'
import {type Props} from '.'
import * as Styles from '../styles'

const People = (props: Props) => (
  <Kb.ScrollView style={styles.container}>
    {props.waiting && <Kb.ProgressIndicator style={styles.progress} />}
    <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.searchContainer}>
      <PeoplePageSearchBar {...props} />
    </Kb.Box2>
    <PeoplePageList {...props} />
  </Kb.ScrollView>
)

const styles = Styles.styleSheetCreate({
  container: {
    ...Styles.globalStyles.fullHeight,
  },
  progress: {
    height: 32,
    left: 96,
    position: 'absolute',
    top: 8,
    width: 32,
    zIndex: 2,
  },
  searchContainer: {
    paddingBottom: Styles.globalMargins.xsmall,
  },
})

export default People
