// @flow
import * as React from 'react'
import * as Kb from '../common-adapters/mobile.native'
import {PeoplePageList} from './index.shared'
import {type Props} from '.'
import {globalStyles, styleSheetCreate} from '../styles'
import {isIOS} from '../constants/platform'
import ProfileSearch from '../profile/search/bar-container'

export const Header = (props: Props) => (
  <Kb.HeaderHocHeader
    borderless={true}
    underNotch={true}
    rightActions={[
      {
        custom: (
          <Kb.Avatar
            username={props.myUsername}
            onClick={() => props.onClickUser(props.myUsername)}
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
        // TODO set refreshing to the actual prop once the bug in RN gets fixed
        // see https://github.com/facebook/react-native/issues/5839
        <Kb.NativeRefreshControl
          refreshing={isIOS ? false : props.waiting}
          onRefresh={() => props.getData()}
        />
      }
    >
      <PeoplePageList {...props} />
    </Kb.ScrollView>
  </>
)

const styles = styleSheetCreate({
  scrollView: {
    ...globalStyles.fullHeight,
  },
})

export default People
