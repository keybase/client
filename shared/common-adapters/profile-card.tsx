import * as React from 'react'
import * as Styles from '../styles'
import * as Platforms from '../util/platforms'
import * as Container from '../util/container'
import * as ProfileGen from '../actions/profile-gen'
import * as Tracker2Constants from '../constants/tracker2'
import * as Tracker2Gen from '../actions/tracker2-gen'
import type * as Tracker2Types from '../constants/types/tracker2'
import capitalize from 'lodash/capitalize'
import Box, {Box2} from './box'
import ClickableBox from './clickable-box'
import ConnectedNameWithIcon from './name-with-icon/container'
import {_setWithProfileCardPopup} from './usernames'
import FloatingMenu from './floating-menu'
import Icon from './icon'
import Meta from './meta'
import ProgressIndicator from './progress-indicator'
import Text from './text'
import WithTooltip from './with-tooltip'
import DelayedMounting from './delayed-mounting'
import FollowButton from '../profile/user/actions/follow-button'
import ChatButton from '../chat/chat-button'

const Kb = {
  Box,
  Box2,
  ClickableBox,
  ConnectedNameWithIcon,
  FloatingMenu,
  Icon,
  Meta,
  ProgressIndicator,
  Text,
  WithTooltip,
}

type Props = {
  clickToProfile?: true
  containerStyle?: Styles.StylesCrossPlatform
  onHide?: () => void
  onLayoutChange?: () => void
  showClose?: true
  username: string
}

const maxIcons = 4

type ServiceIconsProps = {
  userDetailsAssertions?: Map<string, Tracker2Types.Assertion>
}

const assertionTypeToServiceId = (assertionType: string): Platforms.ServiceId | null => {
  switch (assertionType) {
    case 'facebook':
    case 'github':
    case 'hackernews':
    case 'keybase':
    case 'reddit':
    case 'twitter':
      return assertionType
    default:
      return null
  }
}

const ServiceIcons = ({userDetailsAssertions}: ServiceIconsProps) => {
  const services = new Map(
    userDetailsAssertions
      ? [...userDetailsAssertions.values()].map(assertion => [assertion.type, assertion])
      : []
  )
  const serviceIds = [...services]
    .map(([serviceName]) => assertionTypeToServiceId(serviceName))
    .filter(Boolean) as Array<Platforms.ServiceId>
  const [expanded, setExpanded] = React.useState(false)
  const expandLabel =
    !expanded && serviceIds.length > maxIcons ? `+${serviceIds.length - (maxIcons - 1)}` : ''
  const serviceIdsShowing = serviceIds.slice(0, expandLabel ? maxIcons - 1 : undefined)
  return (
    <Kb.Box2
      direction="horizontal"
      gap="tiny"
      style={styles.serviceIcons}
      fullWidth={true}
      centerChildren={true}
    >
      {serviceIdsShowing.map(serviceId => {
        const assertion = services.get(serviceId) || Tracker2Constants.noAssertion
        return (
          <Kb.WithTooltip
            key={serviceId}
            tooltip={
              `${assertion.value} on ${capitalize(serviceId)}` +
              (assertion.state === 'valid' ? '' : ' (unverified)')
            }
            backgroundColor={assertion.state === 'valid' ? undefined : Styles.globalColors.red}
            position="top center"
            showOnPressMobile={true}
            containerStyle={styles.iconContainer}
          >
            <Kb.Icon
              type={Platforms.serviceIdToIcon(serviceId)}
              color={assertion.state === 'valid' ? Styles.globalColors.black : Styles.globalColors.black_20}
            />
            {assertion.state !== 'valid' && (
              <Kb.Icon
                fontSize={Styles.isMobile ? 12 : 10}
                style={styles.brokenBadge}
                type="iconfont-proof-broken"
                color={Styles.globalColors.red}
              />
            )}
          </Kb.WithTooltip>
        )
      })}
      {!!expandLabel && (
        <Kb.ClickableBox onClick={() => setExpanded(true)} style={styles.expand}>
          <Kb.Meta title={expandLabel} backgroundColor={Styles.globalColors.greyDark} />
        </Kb.ClickableBox>
      )}
    </Kb.Box2>
  )
}

const ProfileCard = ({
  clickToProfile,
  onHide,
  showClose,
  containerStyle,
  onLayoutChange,
  username,
}: Props) => {
  const userDetails = Container.useSelector(state => Tracker2Constants.getDetails(state, username))
  const followThem = Container.useSelector(state => Tracker2Constants.followThem(state, username))
  const followsYou = Container.useSelector(state => Tracker2Constants.followsYou(state, username))
  const isSelf = Container.useSelector(state => state.config.username === username)
  const hasBrokenProof = [...(userDetails.assertions || new Map()).values()].find(
    assertion => assertion.state !== 'valid'
  )
  const [showFollowButton, setShowFollowButton] = React.useState(false)
  React.useEffect(() => {
    // Don't show follow button for self; additionally if any proof is broken
    // don't show follow button. If we are aleady following, don't "invite" to
    // unfollow. But dont' hide the button if user has just followed the user.
    !isSelf && !hasBrokenProof && !followThem && userDetails.state === 'valid' && setShowFollowButton(true)
  }, [isSelf, hasBrokenProof, followThem, userDetails])

  const dispatch = Container.useDispatch()

  const {
    state: userDetailsState,
    assertions: userDetailsAssertions,
    bio: userDetailsBio,
    fullname: userDetailsFullname,
  } = userDetails
  React.useEffect(() => {
    userDetailsState === 'unknown' &&
      dispatch(Tracker2Gen.createShowUser({asTracker: false, skipNav: true, username}))
  }, [dispatch, username, userDetailsState])
  // signal layout change when it happens, to prevent popup cutoff.
  React.useEffect(() => {
    onLayoutChange?.()
  }, [
    onLayoutChange,
    userDetailsAssertions,
    userDetailsBio,
    userDetailsFullname,
    userDetailsState,
    showFollowButton,
  ])

  const _changeFollow = React.useCallback(
    (follow: boolean) => dispatch(Tracker2Gen.createChangeFollow({follow, guiID: userDetails.guiID})),
    [dispatch, userDetails]
  )

  const openProfile = React.useCallback(() => {
    dispatch(ProfileGen.createShowUserProfile({username}))
    onHide?.()
  }, [dispatch, onHide, username])

  return (
    <Kb.Box2
      direction="vertical"
      style={Styles.collapseStyles([styles.container, containerStyle])}
      alignItems="center"
    >
      {!!showClose && (
        <Kb.Icon type="iconfont-close" onClick={() => {}} boxStyle={styles.close} padding="tiny" />
      )}
      <Kb.ConnectedNameWithIcon
        onClick={clickToProfile && openProfile}
        colorFollowing={true}
        username={username}
        metaStyle={styles.connectedNameWithIconMetaStyle}
        metaTwo={userDetails.fullname || ''}
        withProfileCardPopup={false}
      />
      {userDetails.state === 'checking' ? (
        <Kb.ProgressIndicator type="Large" />
      ) : (
        <>
          <ServiceIcons userDetailsAssertions={userDetailsAssertions} />
          {!!userDetails.bio && (
            <Kb.Text type="Body" center={true} lineClamp={4} ellipsizeMode="tail">
              {(userDetails.bio || '').replace(/\s/g, ' ')}
            </Kb.Text>
          )}
        </>
      )}
      {showFollowButton &&
        (followThem ? (
          <FollowButton
            key="unfollow"
            following={true}
            onUnfollow={() => _changeFollow(false)}
            waitingKey={Tracker2Constants.waitingKey}
            small={true}
            style={styles.button}
          />
        ) : (
          <FollowButton
            key="follow"
            following={false}
            followsYou={followsYou}
            onFollow={() => _changeFollow(true)}
            waitingKey={Tracker2Constants.waitingKey}
            small={true}
            style={styles.button}
          />
        ))}
      <ChatButton small={true} style={styles.button} username={username} afterClick={onHide} />
    </Kb.Box2>
  )
}

type WithProfileCardPopupProps = {
  username: string
  children: (onLongPress?: () => void) => React.ReactElement<typeof Text>
  ellipsisStyle?: Styles.StylesCrossPlatform
}

export const WithProfileCardPopup = ({username, children, ellipsisStyle}: WithProfileCardPopupProps) => {
  const ref = React.useRef(null)
  const [showing, setShowing] = React.useState(false)
  const [remeasureHint, setRemeasureHint] = React.useState(0)
  const onLayoutChange = React.useCallback(() => setRemeasureHint(Date.now()), [setRemeasureHint])
  const isSelf = Container.useSelector(state => state.config.username === username)
  const onShow = React.useCallback(() => {
    setShowing(true)
  }, [])
  const onHide = React.useCallback(() => {
    setShowing(false)
  }, [])
  if (isSelf) {
    return children()
  }
  const popup = showing && (
    <DelayedMounting delay={Styles.isMobile ? 0 : 500}>
      <Kb.FloatingMenu
        attachTo={() => ref.current}
        closeOnSelect={true}
        onHidden={() => setShowing(false)}
        position="top center"
        positionFallbacks={['top center', 'bottom center']}
        propagateOutsideClicks={!Styles.isMobile}
        remeasureHint={remeasureHint}
        visible={showing}
        header={
          <ProfileCard
            containerStyle={styles.profileCardPopup}
            username={username}
            clickToProfile={true}
            onLayoutChange={onLayoutChange}
            onHide={() => setShowing(false)}
          />
        }
        items={[]}
      />
    </DelayedMounting>
  )
  return Styles.isMobile ? (
    <>
      {children(onShow)}
      {popup}
    </>
  ) : (
    <Kb.Box
      style={Styles.collapseStyles([styles.popupTextContainer, ellipsisStyle])}
      onMouseOver={onShow}
      onMouseLeave={onHide}
      ref={ref}
    >
      {children()}
      {popup}
    </Kb.Box>
  )
}

_setWithProfileCardPopup(WithProfileCardPopup)

export default ProfileCard

const styles = Styles.styleSheetCreate(() => ({
  brokenBadge: Styles.platformStyles({
    common: {
      borderColor: Styles.globalColors.white,
      borderStyle: 'solid',
      borderWidth: Styles.globalMargins.xxtiny,
      bottom: -Styles.globalMargins.xxtiny,
      position: 'absolute',
      right: -Styles.globalMargins.xxtiny,
    },
    isElectron: {
      borderRadius: '50%',
    },
    isMobile: {
      borderRadius: 8,
    },
  }),
  button: {
    marginTop: Styles.globalMargins.xtiny + Styles.globalMargins.xxtiny,
  },
  close: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  connectedNameWithIconMetaStyle: Styles.platformStyles({
    isElectron: {
      marginTop: Styles.globalMargins.xxtiny + Styles.globalMargins.xtiny,
    },
    isMobile: {
      marginTop: (Styles.globalMargins.xxtiny + Styles.globalMargins.xtiny) / 2,
    },
  }),
  container: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
      ...Styles.padding(
        Styles.globalMargins.small,
        Styles.globalMargins.tiny,
        Styles.globalMargins.small,
        Styles.globalMargins.tiny
      ),
      position: 'relative',
    },
    isElectron: {
      width: 170,
    },
  }),
  expand: {
    marginTop: -Styles.globalMargins.xxtiny,
    paddingLeft: Styles.globalMargins.xtiny,
  },
  iconContainer: {
    position: 'relative',
  },
  popupTextContainer: Styles.platformStyles({
    isElectron: {
      display: 'inline-block',
    },
  }),
  profileCardPopup: Styles.platformStyles({
    isMobile: Styles.padding(Styles.globalMargins.large, undefined, Styles.globalMargins.small, undefined),
  }),
  serviceIcons: {
    flexWrap: 'wrap',
    padding: Styles.globalMargins.xtiny + Styles.globalMargins.xxtiny,
  },
}))
