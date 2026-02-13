import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'

type Props = {
  onHidden: () => void
  onReact: (emoji: string) => void
  showPicker: () => void
}

const ReactionItem = (props: Props) => {
  const _topReacjis = Chat.useChatState(s => s.userReacjis.topReacjis)
  const onReact = (emoji: string) => {
    props.onReact(emoji)
    props.onHidden()
  }
  const showPicker = () => {
    props.onHidden()
    // MUST come after, else we'll dismiss the modal we just showed
    setTimeout(() => {
      props.showPicker()
    }, 100)
  }
  const topReacjis = _topReacjis.slice(0, 5)
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.container}>
      {topReacjis.map((r, idx) => (
        <Kb.ClickableBox key={r.name || idx} onClick={() => onReact(r.name)} style={styles.clickableBox}>
          <Kb.Emoji userReacji={r} noAnim={true} showTooltip={false} size={28} />
        </Kb.ClickableBox>
      ))}
      <Kb.ClickableBox onClick={showPicker} style={styles.clickableBox}>
        <Kb.Icon type="iconfont-reacji" />
      </Kb.ClickableBox>
    </Kb.Box2>
  )
}
const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      clickableBox: {
        alignItems: 'center',
        height: 50,
        justifyContent: 'center',
        width: 40,
      },
      container: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'space-between',
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingRight: Kb.Styles.globalMargins.small,
      },
    }) as const
)

export default ReactionItem
