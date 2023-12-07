import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {e164ToDisplay} from '@/util/phone-numbers'

export type Props = {
  username: string
  service: T.TB.ServiceIdWithContact
  tooltip: string
  onRemove: () => void
}

const removeSize = Kb.Styles.isMobile ? 22 : 16

const UserBubble = (props: Props) => {
  const isKeybase = props.service === 'keybase'
  let {username} = props
  let title = !isKeybase ? `${props.username}@${props.service}` : undefined
  if (!isKeybase) {
    // Show placeholder avatar instead of an icon
    username = 'invalidusernameforplaceholderavatar'
    if (props.service === 'phone') {
      // Username is the assertion username here (E164 without '+'), add '+' to
      // obtain a valid number for formatting.
      title = e164ToDisplay('+' + props.username)
    }
  }
  return (
    <Kb.Box2 direction="vertical" className="hover-container" style={styles.bubbleContainer}>
      <Kb.WithTooltip tooltip={props.tooltip} position="top center">
        <Kb.Box2 direction="horizontal" style={styles.bubble}>
          <Kb.ConnectedNameWithIcon
            colorFollowing={true}
            hideFollowingOverlay={true}
            horizontal={false}
            size="smaller"
            // Display `username` for Keybase users for linking to profile pages
            // and for follow. Display `title` for non-Keybase users that always
            // stay gray and is not a link.
            username={username}
            title={title}
            titleStyle={styles.userBubbleTitle}
          />
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" className="hover-visible" style={styles.remove}>
          <RemoveBubble onRemove={props.onRemove} />
        </Kb.Box2>
      </Kb.WithTooltip>
    </Kb.Box2>
  )
}

const RemoveBubble = ({onRemove}: {onRemove: () => void}) => (
  <Kb.ClickableBox onClick={onRemove}>
    <Kb.Icon
      type="iconfont-close"
      color={Kb.Styles.globalColors.black_50_on_white}
      fontSize={Kb.Styles.isMobile ? 14 : 12}
      style={styles.removeIcon}
      className="hover_color_black"
    />
  </Kb.ClickableBox>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      bubble: Kb.Styles.platformStyles({
        common: {
          marginLeft: Kb.Styles.globalMargins.tiny,
          marginRight: Kb.Styles.globalMargins.tiny,
        },
        isElectron: {
          flexShrink: 1,
        },
      }),
      bubbleContainer: Kb.Styles.platformStyles({common: {position: 'relative'}, isMobile: {width: 91}}),
      container: Kb.Styles.platformStyles({
        common: {
          marginBottom: Kb.Styles.globalMargins.xtiny,
          marginLeft: Kb.Styles.globalMargins.tiny,
          marginTop: Kb.Styles.globalMargins.xtiny,
        },
      }),
      generalService: Kb.Styles.platformStyles({
        isElectron: {
          lineHeight: '35px',
        },
      }),
      // TODO: the service icons are too high without this - are they right?
      iconBox: Kb.Styles.platformStyles({
        isElectron: {
          marginBottom: -3,
          marginTop: 3,
        },
      }),
      remove: Kb.Styles.platformStyles({
        common: {
          alignItems: 'center',
          backgroundColor: Kb.Styles.globalColors.white,
          borderRadius: 100,
          height: removeSize,
          justifyContent: 'center',
          position: 'absolute',
          top: 0,
          width: removeSize,
        },
        isElectron: {
          cursor: 'pointer',
          marginRight: Kb.Styles.globalMargins.tiny,
          right: -4,
        },
        isMobile: {
          right: 12,
        },
      }),
      removeIcon: {
        position: 'relative',
        top: 1,
      },
      userBubbleTitle: {color: Kb.Styles.globalColors.black},
    }) as const
)

export default UserBubble
