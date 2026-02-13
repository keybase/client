import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'
import {useTeamsState} from '@/stores/teams'
import * as React from 'react'
import type * as T from '@/constants/types'
import UserNotice from '../user-notice'

type OwnProps = {message: T.Chat.MessageSystemNewChannel}

const SystemNewChannelContainer = React.memo(function SystemNewChannelContainer(p: OwnProps) {
  const {message} = p
  const {teamID} = Chat.useChatContext(s => s.meta)
  const manageChatChannels = useTeamsState(s => s.dispatch.manageChatChannels)
  const onManageChannels = React.useCallback(() => {
    manageChatChannels(teamID)
  }, [manageChatChannels, teamID])

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
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      text: Kb.Styles.platformStyles({
        isElectron: {color: Kb.Styles.globalColors.black_50OrWhite_40},
        isMobile: {color: Kb.Styles.globalColors.black_50},
      }),
    }) as const
)

export default SystemNewChannelContainer
