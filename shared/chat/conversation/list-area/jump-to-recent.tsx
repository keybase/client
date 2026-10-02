import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import {useConversationCenterActions} from '../center-context'
import {useConversationThreadSelector} from '../thread-context'
import {useConversationThreadCloseSearch} from '../thread-navigation'

const JumpToRecent = (props: {onClick: () => void}) => {
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  return (
    <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} style={styles.outerContainer}>
      <Kb.Button label="Jump to recent messages" onClick={props.onClick} small={true} testID={TestIDs.CHAT_JUMP_TO_RECENT}>
        <Kb.Icon
          color={theme.whiteOrWhite}
          type="iconfont-arrow-full-down"
          sizeType="Small"
          style={styles.arrowText}
        />
      </Kb.Button>
    </Kb.Box2>
  )
}

export const useJumpToRecent = (scrollToBottom: () => void, numOrdinals: number) => {
  const {moreToLoadForward, loaded} = useConversationThreadSelector(
    C.useShallow(s => ({loaded: s.loaded, moreToLoadForward: s.moreToLoadForward}))
  )
  const closeThreadSearch = useConversationThreadCloseSearch()
  const {jumpToRecent} = useConversationCenterActions()

  const onJump = () => {
    scrollToBottom()
    jumpToRecent()
    closeThreadSearch()
  }

  return loaded && moreToLoadForward && numOrdinals > 0 && <JumpToRecent onClick={onJump} />
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      arrowText: {paddingRight: Kb.Styles.globalMargins.tiny},
      outerContainer: Kb.Styles.platformStyles({
        // mobile: positioning handled by the keyboard-aware wrapper in list-area
        common: {
          ...Kb.Styles.paddingV(Kb.Styles.globalMargins.small),
        },
        isElectron: {
          backgroundImage: `linear-gradient(transparent, ${theme.white} 75%)`,
          bottom: 0,
          position: 'absolute',
        },
      }),
    }) as const
)
