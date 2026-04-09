import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'

type Props = {
  onHidden: () => void
  onReact: (emoji: string) => void
  showPicker: () => void
}

const useTopReacjis = () =>
  Chat.useChatState(
    C.useShallow(s => [
      s.userReacjis.topReacjis[0],
      s.userReacjis.topReacjis[1],
      s.userReacjis.topReacjis[2],
      s.userReacjis.topReacjis[3],
      s.userReacjis.topReacjis[4],
    ])
  ).filter((reacji): reacji is T.RPCGen.UserReacji => !!reacji)

const ReactionItem = (props: Props) => {
  const topReacjis = useTopReacjis()
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
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} flex={1} style={styles.container} justifyContent="space-between">
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
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingRight: Kb.Styles.globalMargins.small,
      },
    }) as const
)

export default ReactionItem
