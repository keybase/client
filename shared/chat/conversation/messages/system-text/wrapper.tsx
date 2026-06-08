import * as Kb from '@/common-adapters'
import UserNotice from '../user-notice'
import {makeMessageWrapper} from '../wrapper/wrapper'

type OwnProps = {text: string}

function SystemText(p: OwnProps) {
  const {text} = p
  return (
    <UserNotice>
      <Kb.Text type="BodySmall" style={styles.text}>
        {text}
      </Kb.Text>
    </UserNotice>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      text: Kb.Styles.platformStyles({
        isElectron: {wordBreak: 'break-word'} as const,
      }),
    }) as const
)

export default makeMessageWrapper('systemText', message => <SystemText text={message.text.stringValue()} />)
