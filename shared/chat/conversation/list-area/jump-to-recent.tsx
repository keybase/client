import * as Kb from '@/common-adapters'

type Props = {
  onClick: () => void
  style?: Kb.Styles.StylesCrossPlatform
}

const JumpToRecent = (props: Props) => {
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      arrowText: {paddingRight: Kb.Styles.globalMargins.tiny},
      outerContainer: Kb.Styles.platformStyles({
        common: {
          bottom: 0,
          ...Kb.Styles.paddingV(Kb.Styles.globalMargins.small),
          position: 'absolute',
        },
        isElectron: {backgroundImage: `linear-gradient(transparent, ${Kb.Styles.globalColors.white} 75%)`},
      }),
    }) as const
)

export default JumpToRecent
