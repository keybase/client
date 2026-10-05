import * as Kb from '@/common-adapters'
import {useReactionRowTopReacjis} from '@/chat/user-reacjis'

type Props = {
  onHidden: () => void
  onReact: (emoji: string) => void
  showPicker: () => void
}

const ReactionItem = (props: Props) => {
  const styles = useStyles()
  const {onHidden, onReact: _onReact, showPicker: _showPicker} = props

  const topReacjis = useReactionRowTopReacjis()
  const onReact = (emoji: string) => {
    _onReact(emoji)
    onHidden()
  }
  const showPicker = () => {
    onHidden()
    // MUST come after, else we'll dismiss the modal we just showed
    setTimeout(() => {
      _showPicker()
    }, 100)
  }
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} flex={1} alignItems="center" style={styles.container} justifyContent="space-between">
      {topReacjis.map((r, idx) => (
        <Kb.ClickableBox direction="vertical" centerChildren={true} key={r.name || idx} onClick={() => onReact(r.name)} style={styles.clickableBox}>
          <Kb.Emoji userReacji={r} noAnim={true} showTooltip={false} size={28} />
        </Kb.ClickableBox>
      ))}
      <Kb.ClickableBox direction="vertical" centerChildren={true} onClick={showPicker} style={styles.clickableBox}>
        <Kb.Icon type="iconfont-reacji" />
      </Kb.ClickableBox>
    </Kb.Box2>
  )
}
const useStyles = Kb.Styles.createStyleHook(
  () =>
    ({
      clickableBox: {
        height: 50,
        width: 40,
      },
      container: {
        ...Kb.Styles.paddingH(Kb.Styles.globalMargins.small),
      },
    }) as const
)

export default ReactionItem
