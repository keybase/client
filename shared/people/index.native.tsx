import * as React from 'react'
import * as Kb from '../common-adapters/mobile.native'
import {PeoplePageList} from './index.shared'
import type {WrapProps} from '.'
import {globalStyles, styleSheetCreate} from '../styles'

const People = React.memo(function People(props: WrapProps) {
  const {waiting, ...rest} = props
  return (
    <>
      <Kb.ScrollView
        style={styles.scrollView}
        refreshControl={
          <Kb.NativeRefreshControl refreshing={waiting} onRefresh={() => props.getData(false, true)} />
        }
      >
        <PeoplePageList {...rest} />
      </Kb.ScrollView>
    </>
  )
})

const styles = styleSheetCreate(() => ({
  scrollView: {...globalStyles.fullHeight},
}))

export default People
