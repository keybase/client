import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import type * as Types from '../../../../constants/types/chat2'
import UserNotice from '../user-notice'

type Props = {
  message: Types.MessageSystemNewChannel
  onManageChannels: () => void
}

const NewChannel = (props: Props) => {
  const descStyleOverride = React.useMemo(
    () =>
      ({
        link: {fontSize: Styles.isMobile ? 15 : 13, fontWeight: '600'},
        paragraph: {
          fontSize: Styles.isMobile ? 15 : 13,
          ...styles.text,
        },
      } as const),
    []
  )
  const {message, onManageChannels} = props
  return (
    <UserNotice>
      <Kb.Markdown
        smallStandaloneEmoji={true}
        styleOverride={descStyleOverride as any}
        selectable={true}
        style={styles.text}
      >
        {message.text}
      </Kb.Markdown>
      <Kb.Text
        onClick={onManageChannels}
        type="BodySmallSemiboldSecondaryLink"
        style={{color: Styles.globalColors.blueDark}}
      >
        Browse other channels
      </Kb.Text>
    </UserNotice>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  text: Styles.platformStyles({
    isElectron: {
      color: Styles.globalColors.black_50OrWhite_40,
    },
    isMobile: {
      color: Styles.globalColors.black_50,
    },
  }),
}))

export default NewChannel
