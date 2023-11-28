import * as React from 'react'
import * as Kb from '@/common-adapters'
import {PeoplePageList} from './index.shared'
import type {WrapProps} from '.'

const People = React.memo(function People(props: WrapProps) {
  const {waiting, ...rest} = props
  return (
    <Kb.ScrollView style={styles.container}>
      {waiting && <Kb.ProgressIndicator style={styles.progress} />}
      <PeoplePageList {...rest} />
    </Kb.ScrollView>
  )
})

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {...Kb.Styles.globalStyles.fullHeight},
  header: {flexGrow: 1},
  progress: {
    height: 24,
    left: 40,
    position: 'absolute',
    top: -72,
    width: 24,
  },
  searchContainer: {paddingBottom: Kb.Styles.globalMargins.xsmall},
  sectionTitle: {flexGrow: 1},
}))

export default People
