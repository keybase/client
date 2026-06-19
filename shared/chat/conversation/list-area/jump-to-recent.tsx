import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {useConversationCenterActions} from '../center-context'
import {useConversationThreadSelector, useConversationThreadToggleSearch} from '../thread-context'

const JumpToRecent = (props: {onClick: () => void}) => {
  return (
    <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} style={styles.outerContainer}>
      <Kb.Button label="Jump to recent messages" onClick={props.onClick} small={true}>
        <Kb.Icon
          color={Kb.Styles.globalColors.whiteOrWhite}
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
  const toggleThreadSearch = useConversationThreadToggleSearch()
  const {jumpToRecent} = useConversationCenterActions()

  const onJump = () => {
    scrollToBottom()
    jumpToRecent()
    toggleThreadSearch(true)
  }

  return loaded && moreToLoadForward && numOrdinals > 0 && <JumpToRecent onClick={onJump} />
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      arrowText: {paddingRight: Kb.Styles.globalMargins.tiny},
      outerContainer: Kb.Styles.platformStyles({
        // mobile: positioning handled by the keyboard-aware wrapper in list-area
        common: {
          ...Kb.Styles.paddingV(Kb.Styles.globalMargins.small),
        },
        isElectron: {
          backgroundImage: `linear-gradient(transparent, ${Kb.Styles.globalColors.white} 75%)`,
          bottom: 0,
          position: 'absolute',
        },
      }),
    }) as const
)
