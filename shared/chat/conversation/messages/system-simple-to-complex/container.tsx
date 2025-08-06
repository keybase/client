import * as C from '@/constants'
import * as React from 'react'
import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import UserNotice from '../user-notice'

type OwnProps = {message: T.Chat.MessageSystemSimpleToComplex}

const SystemSimpleToComplexContainer = React.memo(function SystemSimpleToComplexContainer(p: OwnProps) {
  const {message} = p
  const teamID = C.useChatContext(s => s.meta.teamID)
  const you = C.useCurrentUserState(s => s.username)
  const manageChatChannels = C.useTeamsState(s => s.dispatch.manageChatChannels)
  const onManageChannels = React.useCallback(() => {
    manageChatChannels(teamID)
  }, [manageChatChannels, teamID])
  const {team, author} = message
  return (
    <UserNotice>
      <Kb.Text type="BodySmall">
        {author === you ? 'You ' : ''}made <Kb.Text type="BodySmallBold">{team}</Kb.Text> a big team! Note
        that:
      </Kb.Text>
      <Kb.Box2
        direction="vertical"
        alignSelf="flex-start"
        gap="tiny"
        style={{marginLeft: Kb.Styles.globalMargins.tiny, marginTop: Kb.Styles.globalMargins.xtiny}}
      >
        <Kb.Text type="BodySmall">
          <Kb.Text type="BodySmall" style={styles.bullet}>
            {bullet}
          </Kb.Text>
          Your team channels will now appear in the "Big teams" section of the inbox.
        </Kb.Text>

        <Kb.Text type="BodySmall">
          <Kb.Text type="BodySmall" style={styles.bullet}>
            {bullet}
          </Kb.Text>
          Everyone can now create and join channels.{' '}
          <Kb.Text
            onClick={onManageChannels}
            type="BodySmallSemiboldSecondaryLink"
            style={{color: Kb.Styles.globalColors.blueDark}}
          >
            Browse other channels
          </Kb.Text>
        </Kb.Text>
      </Kb.Box2>
    </UserNotice>
  )
})

const bullet = '\u2022 '

const styles = Kb.Styles.styleSheetCreate(() => ({
  bullet: {marginRight: Kb.Styles.globalMargins.small},
}))

export default SystemSimpleToComplexContainer
