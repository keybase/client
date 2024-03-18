import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Platforms from '@/constants/platform'

const HeaderNewChatButton = () => {
  const hide = C.useChatState(
    s =>
      s.inboxHasLoaded &&
      !!s.inboxLayout &&
      (s.inboxLayout.smallTeams || []).length === 0 &&
      (s.inboxLayout.bigTeams || []).length === 0
  )

  const appendNewChatBuilder = C.useRouterState(s => s.appendNewChatBuilder)
  const onNewChat = React.useCallback(() => {
    appendNewChatBuilder()
  }, [appendNewChatBuilder])
  const content = React.useMemo(() => {
    return (
      <Kb.Box2
        direction="vertical"
        style={styles.rainbowButtonContainer}
        tooltip={`(${Platforms.shortcutSymbol}N)`}
        className="tooltip-right"
      >
        <Kb.Box2 direction="vertical" style={styles.gradientContainer} pointerEvents="none">
          <Kb.Box style={styles.gradientRed} />
          <Kb.Box style={styles.gradientOrange} />
          <Kb.Box style={styles.gradientYellow} />
          <Kb.Box style={styles.gradientGreen} />
        </Kb.Box2>
        <Kb.Button
          label={'New chat'}
          mode="Primary"
          onClick={onNewChat}
          small={true}
          style={styles.rainbowButton}
          type="Default"
        />
      </Kb.Box2>
    )
  }, [onNewChat])
  return hide ? null : content
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      button: {
        marginLeft: Kb.Styles.globalMargins.small,
        marginRight: Kb.Styles.globalMargins.small,
      },
      gradientContainer: {
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      },
      gradientGreen: Kb.Styles.platformStyles({
        common: {
          backgroundColor: '#3AFFAC',
          borderBottomLeftRadius: Kb.Styles.borderRadius,
          borderBottomRightRadius: Kb.Styles.borderRadius,
          flex: 1,
        },
      }),
      gradientOrange: {backgroundColor: '#FFAC3D', flex: 1},
      gradientRed: Kb.Styles.platformStyles({
        common: {
          backgroundColor: '#FF5D5D',
          borderTopLeftRadius: Kb.Styles.borderRadius,
          borderTopRightRadius: Kb.Styles.borderRadius,
          flex: 1,
        },
      }),
      gradientYellow: {backgroundColor: '#FFF75A', flex: 1},
      newMeta: {
        alignSelf: 'center',
        marginRight: Kb.Styles.globalMargins.tiny,
      },
      rainbowButton: Kb.Styles.platformStyles({
        common: {
          margin: 2,
          paddingLeft: Kb.Styles.globalMargins.tiny,
          paddingRight: Kb.Styles.globalMargins.tiny,
        },
      }),
      rainbowButtonContainer: Kb.Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
          height: '100%',
          position: 'relative',
        },
        isElectron: {
          ...Kb.Styles.desktopStyles.windowDraggingClickable,
        },
      }),
    }) as const
)

export {HeaderNewChatButton}
export default HeaderNewChatButton
