import * as React from 'react'
import * as Styles from '../styles'
import * as Platforms from '../util/platforms'
import * as Container from '../util/container'
import * as Tracker2Constants from '../constants/tracker2'
import * as Tracker2Types from '../constants/types/tracker2'
import * as Tracker2Gen from '../actions/tracker2-gen'
import capitalize from 'lodash-es/capitalize'
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
import FollowButton from '../profile/user/actions/follow-button'

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
  showClose?: true
  username: string
}

const maxIcons = 4

type ServiceIconsProps = {
  userDetails: Tracker2Types.Details
}

const assertionTypeToServiceId = (assertionType): Platforms.ServiceId | null => {
  switch (assertionType) {
    case 'facebook':
    case 'github':
    case 'hackernews':
    case 'keybase:':
    case 'reddit:':
    case 'twitter':
      return assertionType
    default:
      return null
  }
}

const ServiceIcons = ({userDetails}: ServiceIconsProps) => {
  const services = new Map(
    userDetails.assertions
      ? userDetails.assertions.toArray().map(([_, assertion]) => [assertion.type, assertion.value])
      : []
  )
  const serviceIds = [...services]
    .map(([serviceName]) => assertionTypeToServiceId(serviceName))
    .filter(Boolean) as Array<Platforms.ServiceId>
  const [expanded, setExpanded] = React.useState(false)
  const expandLabel =
    !expanded && serviceIds.length > maxIcons ? `+${serviceIds.length - (maxIcons - 1)}` : ''
  return (
    <Kb.Box2
      direction="horizontal"
      gap="xtiny"
      style={styles.serviceIcons}
      fullWidth={true}
      centerChildren={true}
    >
      {serviceIds.slice(0, expandLabel ? maxIcons - 1 : undefined).map(serviceId => (
        <Kb.WithTooltip
          key={serviceId}
          tooltip={`${services.get(serviceId)} on ${capitalize(serviceId)}`}
          position="top center"
        >
          <Kb.Icon fontSize={14} type={Platforms.serviceIdToIcon(serviceId)} />
        </Kb.WithTooltip>
      ))}
      {!expanded && serviceIds.length > 4 && (
        <Kb.ClickableBox onClick={() => setExpanded(true)} style={styles.expand}>
          <Kb.Meta title={`+${serviceIds.length - 3}`} backgroundColor={Styles.globalColors.greyDark} />
        </Kb.ClickableBox>
      )}
    </Kb.Box2>
  )
}

const ProfileCard = ({clickToProfile, showClose, username}: Props) => {
  const userDetails = Container.useSelector(state => Tracker2Constants.getDetails(state, username))
  const followThem = Container.useSelector(state => Tracker2Constants.followThem(state, username))
  const followsYou = Container.useSelector(state => Tracker2Constants.followsYou(state, username))
  const isSelf = Container.useSelector(state => state.config.username === username)

  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    dispatch(Tracker2Gen.createShowUser({asTracker: false, skipNav: true, username}))
  }, [dispatch, username])
  const _changeFollow = React.useCallback(
    (follow: boolean) => dispatch(Tracker2Gen.createChangeFollow({follow, guiID: userDetails.guiID})),
    [dispatch, userDetails]
  )

  return (
    <Kb.Box2 direction="vertical" style={styles.container} alignItems="center">
      {showClose && (
        <Kb.Icon type="iconfont-close" onClick={() => {}} boxStyle={styles.close} padding="tiny" />
      )}
      <Kb.ConnectedNameWithIcon
        onClick={clickToProfile && 'profile'}
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
          <ServiceIcons userDetails={userDetails} />
          {userDetails.bio && (
            <Kb.Text type="Body" center={true}>
              {userDetails.bio}
            </Kb.Text>
          )}
        </>
      )}
      {!isSelf &&
        (followThem ? (
          <FollowButton
            key="unfollow"
            following={true}
            onUnfollow={() => _changeFollow(false)}
            waitingKey={Tracker2Constants.waitingKey}
            style={styles.button}
          />
        ) : (
          <FollowButton
            key="follow"
            following={false}
            followsYou={followsYou}
            onFollow={() => _changeFollow(true)}
            waitingKey={Tracker2Constants.waitingKey}
            style={styles.button}
          />
        ))}
    </Kb.Box2>
  )
}

type WithProfileCardPopupProps = {
  username: string
  children: (ref: React.Ref<any>) => React.ReactNode
}

export const WithProfileCardPopup = ({username, children}: WithProfileCardPopupProps) => {
  const ref = React.useRef(null)
  const [showing, setShowing] = React.useState(false)
  const popup = showing && (
    <Kb.FloatingMenu
      attachTo={() => ref.current}
      closeOnSelect={true}
      onHidden={() => setShowing(false)}
      position="top center"
      propagateOutsideClicks={!Styles.isMobile}
      header={{
        title: '',
        view: <ProfileCard username={username} clickToProfile={true} />,
      }}
      items={[]}
      visible={showing}
    />
  )
  return Styles.isMobile ? (
    <>
      {children(ref)}
      {popup}
    </>
  ) : (
    <Kb.Box
      style={styles.popupTextContainer}
      onMouseOver={() => setShowing(true)}
      onMouseLeave={() => setShowing(false)}
    >
      {children(ref)}
      {popup}
    </Kb.Box>
  )
}

_setWithProfileCardPopup(WithProfileCardPopup)

export default ProfileCard

const styles = Styles.styleSheetCreate(() => ({
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
  container: {
    backgroundColor: Styles.globalColors.white,
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.tiny,
    paddingRight: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.small,
    position: 'relative',
    width: 170,
  },
  expand: {
    paddingLeft: Styles.globalMargins.xtiny,
  },
  popupTextContainer: Styles.platformStyles({
    isElectron: {
      display: 'inline-block',
    },
  }),
  serviceIcons: {
    flexWrap: 'wrap',
    padding: Styles.globalMargins.xtiny + Styles.globalMargins.xxtiny,
  },
}))
