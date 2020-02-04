import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as Types from '../../../../constants/types/chat2'
import UserNotice from '../user-notice'

type Props = {
  message: Types.MessageSystemNewChannel
}

const NewChannel = (props: Props) => {
  const descStyleOverride = {
    link: {fontSize: Styles.isMobile ? 15 : 13, fontWeight: 600},
    paragraph: Styles.collapseStyles([
      {
        fontSize: Styles.isMobile ? 15 : 13,
      },
      styles.text,
    ]),
  } as any
  const {message} = props
  return (
    <UserNotice>
      <Kb.Markdown
        smallStandaloneEmoji={true}
        styleOverride={descStyleOverride}
        selectable={true}
        style={styles.text}
      >
        {message.text}
      </Kb.Markdown>
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
