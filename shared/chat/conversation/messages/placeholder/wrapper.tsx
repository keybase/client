import * as C from '../../../../constants'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as Container from '../../../../util/container'
import * as React from 'react'
import * as T from '../../../../constants/types'
import {WrapperMessage, type Props} from '../wrapper/wrapper'
import {ForceListRedrawContext} from '../../force-list-redraw-context'
import {useChatDebugDump} from '../../../../constants/chat2/debug'

const noop = () => {}

const baseWidth = Styles.isMobile ? 100 : 150
const mult = Styles.isMobile ? 5 : 10

const WrapperPlaceholder = React.memo(function WrapperPlaceholder(p: Props) {
  const {ordinal} = p
  const o = T.Chat.ordinalToNumber(ordinal)
  const code = o * 16807
  const width = baseWidth + (code % 20) * mult // pseudo randomize the length
  const noAnchor = React.useRef(null)

  const forceListRedraw = React.useContext(ForceListRedrawContext)

  const type = C.useChatContext(s => s.messageMap.get(ordinal)?.type)
  const [lastType, setLastType] = React.useState(type)

  useChatDebugDump(
    `wrapper${o}`,
    Container.useEvent(() => {
      return `placeholder: ${o}: ${type ?? ''}`
    })
  )

  if (lastType !== type) {
    setLastType(type)
    if (type !== 'placeholder') {
      forceListRedraw()
    }
  }

  return (
    <WrapperMessage
      {...p}
      showCenteredHighlight={false}
      toggleShowingPopup={noop}
      showingPopup={false}
      popup={null}
      popupAnchor={noAnchor}
    >
      <Kb.Box2 direction="horizontal" gap="tiny" style={styles.container}>
        <Kb.Placeholder width={width} />
      </Kb.Box2>
    </WrapperMessage>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        alignItems: 'center',
        height: Styles.isMobile ? 22 : 17, // to match a line of text
        width: '100%',
      },
      spinner: {
        height: 16,
        marginLeft: 0,
        width: 16,
      },
    }) as const
)

export default WrapperPlaceholder
