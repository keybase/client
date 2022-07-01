import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

type Props = {
  ordinal: Types.Ordinal
}

const baseWidth = Styles.isMobile ? 100 : 150
const mult = Styles.isMobile ? 5 : 10

const MessagePlaceholder = React.memo((props: Props) => {
  const o = Types.ordinalToNumber(props.ordinal)
  const code = o * 16807
  const width = baseWidth + (code % 20) * mult // pseudo randomize the length
  return (
    <Kb.Box2 direction="horizontal" gap="tiny" style={styles.container}>
      <Kb.ProgressIndicator style={styles.spinner} />
      <Kb.Placeholder width={width} />
    </Kb.Box2>
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
    } as const)
)

export default MessagePlaceholder
