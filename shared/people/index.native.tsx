import * as React from 'react'
import * as Kb from '../common-adapters/mobile.native'
import {PeoplePageList} from './index.shared'
import {Props} from '.'
import {globalStyles, styleSheetCreate} from '../styles'
import InviteFriends from './invite-friends/tab-bar-button'
import flags from '../util/feature-flags'

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
    {flags.inviteFriends && <InviteFriends />}
  </>
))

const styles = styleSheetCreate(() => ({
  scrollView: {...globalStyles.fullHeight},
}))

export default People
