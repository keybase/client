import * as React from 'react'
import * as Kb from '../common-adapters/mobile.native'
import {PeoplePageList} from './index.shared'
import {Props} from '.'
import {globalStyles, styleSheetCreate} from '../styles'
import ProfileSearch from '../profile/search/bar-container'
import ff from '../util/feature-flags.native'

export const Header = (props: Props) => (
  <Kb.HeaderHocHeader
    borderless={true}
    underNotch={true}
    rightActions={[
      {
        custom: (
          <Kb.Avatar
            username={props.myUsername}
            onClick={
              ff.fastAccountSwitch ? props.onOpenAccountSwitcher : () => props.onClickUser(props.myUsername)
            }
            size={32}
          />
        ),
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
  </>
)

const styles = styleSheetCreate(() => ({
  scrollView: {
    ...globalStyles.fullHeight,
  },
}))

export default People
