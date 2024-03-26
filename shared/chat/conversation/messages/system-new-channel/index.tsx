import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import UserNotice from '../user-notice'

type Props = {
  message: T.Chat.MessageSystemNewChannel
  onManageChannels: () => void
}

const NewChannel = (props: Props) => {
  const descStyleOverride = React.useMemo(
    () =>
      ({
        link: {fontSize: Kb.Styles.isMobile ? 15 : 13, fontWeight: '600'},
        paragraph: {
          color: Kb.Styles.isMobile
            ? Kb.Styles.globalColors.black_50
            : Kb.Styles.globalColors.black_50OrWhite_40,
          fontSize: Kb.Styles.isMobile ? 15 : 13,
        },
      }) as const,
    []
  )
  const {message, onManageChannels} = props
  return (
    <UserNotice>
      <Kb.Markdown
        smallStandaloneEmoji={true}
        styleOverride={descStyleOverride}
        selectable={true}
        style={styles.text}
      >
        {message.text.stringValue()}
      </Kb.Markdown>
      <Kb.Text
        onClick={onManageChannels}
        type="BodySmallSemiboldSecondaryLink"
        style={{color: Kb.Styles.globalColors.blueDark}}
      >
        Browse other channels
      </Kb.Text>
    </UserNotice>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      text: Kb.Styles.platformStyles({
        isElectron: {color: Kb.Styles.globalColors.black_50OrWhite_40},
        isMobile: {color: Kb.Styles.globalColors.black_50},
      }),
    }) as const
)

export default NewChannel
