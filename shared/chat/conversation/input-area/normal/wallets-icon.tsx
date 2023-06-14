import * as React from 'react'
import * as ConfigConstants from '../../../../constants/config'
import * as WalletsGen from '../../../../actions/wallets-gen'
import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import type * as Types from '../../../../constants/types/chat2'
import shallowEqual from 'shallowequal'

export type WalletsIconProps = {
  conversationIDKey: Types.ConversationIDKey
  size: number
  style?: Styles.StylesCrossPlatform
}
const WalletsIcon = (props: WalletsIconProps) => {
  const {size, style, conversationIDKey} = props

  const you = ConfigConstants.useCurrentUserState(s => s.username)
  const {participantInfo} = Container.useSelector(state => {
    const participantInfo = Constants.getParticipantInfo(state, conversationIDKey)
    return {participantInfo}
  }, shallowEqual)
  const otherParticipants = participantInfo.name.filter(u => u !== you)
  const to = otherParticipants[0]
  const dispatch = Container.useDispatch()

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, toggleShowingPopup} = p
      const onRequest = () => {
        dispatch(WalletsGen.createOpenSendRequestForm({isRequest: true, recipientType: 'keybaseUser', to}))
      }
      const onSend = () => {
        dispatch(WalletsGen.createOpenSendRequestForm({isRequest: false, recipientType: 'keybaseUser', to}))
      }
      return (
        <Kb.FloatingMenu
          closeOnSelect={true}
          attachTo={attachTo}
          items={[
            {icon: 'iconfont-stellar-send', onClick: onSend, title: 'Send Lumens (XLM)'},
            {icon: 'iconfont-stellar-request', onClick: onRequest, title: 'Request Lumens (XLM)'},
          ]}
          onHidden={toggleShowingPopup}
          position="top right"
          visible={true}
        />
      )
    },
    [dispatch, to]
  )
  const {toggleShowingPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  return (
    <Kb.Box2
      ref={popupAnchor as any}
      direction="horizontal"
      style={Styles.collapseStyles([styles.container, style])}
    >
      <Kb.Icon type="iconfont-dollar-sign" fontSize={size} onClick={toggleShowingPopup} />
      {popup}
    </Kb.Box2>
  )
}

const radius = 4
const styles = Styles.styleSheetCreate(
  () =>
    ({
      badge: Styles.platformStyles({
        common: {alignSelf: 'center'},
        isMobile: {
          position: 'absolute',
          right: 0,
          top: 2,
        },
      }),
      container: {
        padding: Styles.globalMargins.xtiny,
        position: 'relative',
      },
      menuItemBox: Styles.platformStyles({
        common: {alignItems: 'center'},
        isElectron: {justifyContent: 'space-between'},
        isMobile: {justifyContent: 'center'},
      }),
      newBadge: {
        backgroundColor: Styles.globalColors.blue,
        borderColor: Styles.globalColors.white,
        borderRadius: radius,
        borderStyle: 'solid',
        borderWidth: 1,
        height: radius * 2,
        position: 'absolute',
        right: -1,
        top: -2,
        width: radius * 2,
      },
      text: Styles.platformStyles({
        isMobile: {color: Styles.globalColors.blueDark},
      }),
    } as const)
)

export default WalletsIcon
