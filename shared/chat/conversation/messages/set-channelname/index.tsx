import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'

type Props = {
  message: T.Chat.MessageSetChannelname
}

const ChannelNameMessage = (props: Props) => (
  <Kb.Text type="BodySmall" style={styles.text} selectable={true}>
    set the channel name to #{props.message.newChannelname}
  </Kb.Text>
)
export default ChannelNameMessage

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      text: {flexGrow: 1},
    }) as const
)
