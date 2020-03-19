import * as React from 'react'
import * as Kb from '../common-adapters/mobile.native'
import {PeoplePageList} from './index.shared'
import {Props} from '.'
import {globalStyles, styleSheetCreate} from '../styles'
import ProfileSearch from '../profile/search/bar'
import InviteFriends from './invite-friends/tab-bar-button'
import flags from '../util/feature-flags'
export const Header = (props: Props) => (
  <Kb.HeaderHocHeader
    borderless={true}
    underNotch={true}
    rightActions={[
      {
        custom: <Kb.Avatar username={props.myUsername} onClick={props.onOpenAccountSwitcher} size={32} />,
        label: 'Avatar',
      },
    ]}
    titleComponent={<ProfileSearch />}
  />
)

const People = (props: Props) => (
  <>
    <Kb.ScrollView
      style={styles.scrollView}
      refreshControl={
        <Kb.NativeRefreshControl refreshing={props.waiting} onRefresh={() => props.getData()} />
      }
    >
      <PeoplePageList {...props} />
    </Kb.ScrollView>
    {flags.inviteFriends && <InviteFriends />}
  </>
)

const styles = styleSheetCreate(() => ({
  scrollView: {
    ...globalStyles.fullHeight,
  },
}))

export default People
