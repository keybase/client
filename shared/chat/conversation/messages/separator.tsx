import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import {formatTimeForConversationList} from '@/util/timestamp'
import {OrangeLineContext} from '../orange-line-context'

const missingMessage = Chat.makeMessageDeleted({})

// Single merged selector replacing useStateFast + useState
const useSeparatorData = (trailingItem: T.Chat.Ordinal, leadingItem: T.Chat.Ordinal) => {
  const ordinal = Kb.Styles.isMobile ? leadingItem : trailingItem
  const orangeOrdinal = React.useContext(OrangeLineContext)

  return Chat.useChatContext(
    C.useShallow(s => {
      const previous = s.separatorMap.get(ordinal) ?? T.Chat.numberToOrdinal(0)
      const m = s.messageMap.get(ordinal) ?? missingMessage
      const showUsername = s.showUsernameMap.get(ordinal) ?? ''
      const tooSoon = !m.timestamp || new Date().getTime() - m.timestamp < 1000 * 60 * 60 * 2
      const orangeMessage = orangeOrdinal ? s.messageMap.get(orangeOrdinal) : undefined
      const orangeOrdinalExists =
        orangeOrdinal && s.messageMap.has(orangeOrdinal) && orangeMessage?.type !== 'placeholder'
      const orangeLineAbove =
        orangeOrdinalExists &&
        (orangeOrdinal === ordinal || (orangeOrdinal < ordinal && orangeOrdinal > previous))
      const isJoinLeave = m.type === 'systemJoined'
      const orangeTime =
        !C.isMobile && !showUsername && !tooSoon && !isJoinLeave
          ? formatTimeForConversationList(m.timestamp)
          : ''

      return {orangeLineAbove, orangeTime, ordinal}
    })
  )
}

type Props = {
  leadingItem?: T.Chat.Ordinal
  trailingItem: T.Chat.Ordinal
}

function SeparatorConnector(p: Props) {
  const {leadingItem, trailingItem} = p
  const data = useSeparatorData(trailingItem, leadingItem ?? T.Chat.numberToOrdinal(0))
  const {ordinal, orangeLineAbove, orangeTime} = data

  if (!ordinal || !orangeLineAbove) return null

  return (
    <Kb.Box2
      direction="horizontal"
      style={styles.container}
      fullWidth={true}
      pointerEvents="box-none"
      className="WrapperMessage-hoverColor"
    >
      <Kb.Box2 key="orangeLine" direction="vertical" style={styles.orangeLine}>
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
        common: {
          position: 'relative',
        },
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
          flexShrink: 0,
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
