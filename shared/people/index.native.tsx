import * as React from 'react'
import * as Kb from '../common-adapters/mobile.native'
import {PeoplePageList} from './index.shared'
import {Props} from '.'
import {globalStyles, styleSheetCreate} from '../styles'

const People = React.memo((props: Props) => (
  <>
    <Kb.ScrollView
      style={styles.scrollView}
      refreshControl={
        <Kb.NativeRefreshControl refreshing={props.waiting} onRefresh={() => props.getData(false, true)} />
      }
    >
      <PeoplePageList {...props} />
    </Kb.ScrollView>
  </>
))

const styles = styleSheetCreate(() => ({
  scrollView: {...globalStyles.fullHeight},
}))

export default People
