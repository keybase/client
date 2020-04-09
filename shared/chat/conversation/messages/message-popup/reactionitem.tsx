import * as React from 'react'
import * as Container from '../../../../util/container'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {renderEmoji, RPCUserReacjiToRenderableEmoji} from '../../../../util/emoji'

type Props = {
  onHidden: () => void
  onReact: (emoji: string) => void
  showPicker: () => void
}

const ReactionItem = (props: Props) => {
  const _topReacjis = Container.useSelector(state => state.chat2.userReacjis.topReacjis)
  const onReact = (emoji: string) => {
    props.onReact(emoji)
    props.onHidden()
  }
  const showPicker = () => {
    props.showPicker()
    props.onHidden()
  }
  const topReacjis = _topReacjis.slice(0, 5)
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.container}>
      {topReacjis.map(r => (
        <Kb.ClickableBox key="picker" onClick={() => onReact(r.name)} style={styles.clickableBox}>
          {renderEmoji(RPCUserReacjiToRenderableEmoji(r, true), 28, false)}
        </Kb.ClickableBox>
      ))}
      <Kb.ClickableBox onClick={showPicker} style={styles.clickableBox}>
        <Kb.Icon type="iconfont-reacji" />
      </Kb.ClickableBox>
    </Kb.Box2>
  )
}
const styles = Styles.styleSheetCreate(
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
        paddingLeft: Styles.globalMargins.small,
        paddingRight: Styles.globalMargins.small,
      },
    } as const)
)

export default ReactionItem
