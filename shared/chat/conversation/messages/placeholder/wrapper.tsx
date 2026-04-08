import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import {WrapperMessage, useWrapperMessage, type Props} from '../wrapper/wrapper'
import {ForceListRedrawContext} from '../../force-list-redraw-context'

const baseWidth = Kb.Styles.isMobile ? 100 : 150
const mult = Kb.Styles.isMobile ? 5 : 10

function WrapperPlaceholder(p: Props) {
  const {ordinal, isCenteredHighlight} = p
  const o = T.Chat.ordinalToNumber(ordinal)
  const code = o * 16807
  const width = baseWidth + (code % 20) * mult // pseudo randomize the length
  const wrapper = useWrapperMessage(ordinal, isCenteredHighlight)

  const forceListRedraw = React.useContext(ForceListRedrawContext)

  const {type} = wrapper.messageData
  const [lastType, setLastType] = React.useState(type)

  if (lastType !== type) {
    setLastType(type)
    if (type !== 'placeholder') {
      forceListRedraw()
    }
  }

  return (
    <WrapperMessage {...p} {...wrapper}>
      <Kb.Box2 direction="horizontal" gap="tiny" style={styles.container}>
        <Kb.Placeholder width={width} />
      </Kb.Box2>
    </WrapperMessage>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        alignItems: 'center',
        height: Kb.Styles.isMobile ? 22 : 17, // to match a line of text
        width: '100%',
      },
    }) as const
)

export default WrapperPlaceholder
