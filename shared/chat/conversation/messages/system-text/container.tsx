import * as React from 'react'
import * as Kb from '@/common-adapters'
import UserNotice from '../user-notice'

type OwnProps = {text: string}

const SystemTextContainer = React.memo(function SystemTextContainer(p: OwnProps) {
  const {text} = p
  return (
    <UserNotice>
      <Kb.Text3 type="BodySmall" style={styles.text}>
        {text}
      </Kb.Text3>
    </UserNotice>
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      text: Kb.Styles.platformStyles({
        isElectron: {wordBreak: 'break-word'} as const,
      }),
    }) as const
)

export default SystemTextContainer
