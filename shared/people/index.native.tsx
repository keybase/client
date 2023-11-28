import * as React from 'react'
import * as Kb from '@/common-adapters'
import {PeoplePageList} from './index.shared'
import type {WrapProps} from '.'
import {RefreshControl} from 'react-native'

const People = React.memo(function People(props: WrapProps) {
  const {waiting, ...rest} = props
  return (
    <>
      <Kb.ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={waiting} onRefresh={() => props.getData(false, true)} />}
      >
        <PeoplePageList {...rest} />
      </Kb.ScrollView>
    </>
  )
})

const styles = Kb.Styles.styleSheetCreate(() => ({
  scrollView: {...Kb.Styles.globalStyles.fullHeight},
}))

export default People
