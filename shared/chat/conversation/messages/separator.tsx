import * as C from '@/constants'
import * as Chat from '@/constants/chat'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as RowMetadata from './row-metadata'
import * as T from '@/constants/types'
import {formatTimeForConversationList} from '@/util/timestamp'
import {OrangeLineContext} from '../orange-line-context'
import {useCurrentUserState} from '@/stores/current-user'
import {useConversationThreadSelector} from '../thread-context'

const missingMessage = Chat.makeMessageDeleted({})
const noOrdinal = T.Chat.numberToOrdinal(0)

// Single merged selector replacing useStateFast + useState. The separator renders inline above
// `trailingItem` on both platforms, so the orange line sits above that ordinal's message.
const useSeparatorData = (trailingItem: T.Chat.Ordinal) => {
  const orangeOrdinal = React.useContext(OrangeLineContext)
  const you = useCurrentUserState(s => s.username)

  return useConversationThreadSelector(
    C.useShallow(s => {
      const messageOrdinals = s.messageOrdinals ?? []
      const ordinal = trailingItem
      const m = s.messageMap.get(ordinal) ?? missingMessage
      const orangeMessage = s.messageMap.get(orangeOrdinal || noOrdinal)
      const previous = RowMetadata.getPreviousOrdinal(messageOrdinals, ordinal)
      const orangeOrdinalExists =
        !!orangeOrdinal && s.messageMap.has(orangeOrdinal) && orangeMessage?.type !== 'placeholder'
      const orangeLineAbove =
        orangeOrdinalExists &&
        (orangeOrdinal === ordinal || (orangeOrdinal < ordinal && orangeOrdinal > previous))

      // only pay for the time label when an orange line will actually render
      let orangeTime = ''
      if (orangeLineAbove && !isMobile) {
        const showUsername = RowMetadata.getMessageShowUsername({
          message: m,
          messageMap: s.messageMap,
          messageOrdinals,
          ordinal,
          you,
        })
        const tooSoon = !m.timestamp || Date.now() - m.timestamp < 1000 * 60 * 60 * 2
        const isJoinLeave = m.type === 'systemJoined'
        if (!showUsername && !tooSoon && !isJoinLeave) {
          orangeTime = formatTimeForConversationList(m.timestamp)
        }
      }

      return {orangeLineAbove, orangeTime, ordinal}
    })
  )
}

type Props = {
  trailingItem: T.Chat.Ordinal
}

function SeparatorConnector(p: Props) {
  const {trailingItem} = p
  const data = useSeparatorData(trailingItem)
  const {ordinal, orangeLineAbove, orangeTime} = data

  if (!ordinal || !orangeLineAbove) return null

  return (
    <Kb.Box2
      direction="horizontal"
      relative={true}
      style={styles.container}
      fullWidth={true}
      pointerEvents="box-none"
      className="WrapperMessage-hoverColor"
    >
      <Kb.Box2 key="orangeLine" direction="vertical" noShrink={true} style={styles.orangeLine}>
        {orangeTime ? (
          <Kb.Text type="BodyTiny" key="orangeLineLabel" style={styles.orangeLabel}>
            {orangeTime}
          </Kb.Text>
        ) : null}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        isElectron: {
          marginBottom: 0,
          paddingTop: 5,
        },
      }),
      orangeLabel: {
        backgroundColor: Kb.Styles.globalColors.orange,
        borderBottomRightRadius: 4,
        color: Kb.Styles.globalColors.white,
        left: 0,
        opacity: 0.7,
        paddingLeft: 2,
        paddingRight: 2,
        position: 'absolute',
        top: 0,
      },
      orangeLine: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.orange,
          height: 1,
          left: 0,
          position: 'absolute',
          right: 0,
          top: 0,
        },
        isElectron: {
          // we're inside a padded container so just bust out a little
          right: -16,
        },
      }),
    }) as const
)

export default SeparatorConnector
