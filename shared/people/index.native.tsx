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

const People = (props: Props) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const [justSignedUp, isPushEnabled, showPushPrompt] = Container.useSelector(state => [
    state.signup.justSignedUp,
    state.push.hasPermissions,
    state.push.showPushPrompt,
  ])
  React.useEffect(() => {
    if (justSignedUp) {
      if (!isPushEnabled && showPushPrompt) {
        dispatch(nav.safeNavigateAppendPayload({path: ['settingsPushPrompt']}))
      }
      return () => dispatch(SignupGen.createClearJustSignedUp())
    }
  }, [dispatch, nav, justSignedUp, isPushEnabled, showPushPrompt])
  return (
    <Kb.ScrollView
      style={styles.scrollView}
      refreshControl={
        <Kb.NativeRefreshControl refreshing={props.waiting} onRefresh={() => props.getData()} />
      }
    >
      <PeoplePageList {...props} />
    </Kb.ScrollView>
  )
}

const styles = styleSheetCreate(() => ({
  scrollView: {
    ...globalStyles.fullHeight,
  },
}))

export default People
