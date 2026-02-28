import * as Kb from '@/common-adapters'

type Props = {
  onClick: () => void
  style?: Kb.Styles.StylesCrossPlatform
}

const JumpToRecent = (props: Props) => {
  return (
    <Kb.Box2 direction="vertical" style={styles.outerContainer}>
      <Kb.Button label="Jump to recent messages" onClick={props.onClick} small={true}>
        <Kb.Icon
          color={Kb.Styles.globalColors.whiteOrWhite}
          type="iconfont-arrow-full-down"
          boxStyle={styles.arrowBox}
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
      arrowBox: Kb.Styles.platformStyles({
        isElectron: {display: 'inline'},
      }),
      arrowText: {paddingRight: Kb.Styles.globalMargins.tiny},
      outerContainer: Kb.Styles.platformStyles({
        common: {
          alignItems: 'center',
          bottom: 0,
          paddingBottom: Kb.Styles.globalMargins.small,
          paddingTop: Kb.Styles.globalMargins.small,
          position: 'absolute',
          width: '100%',
        },
        isElectron: {backgroundImage: `linear-gradient(transparent, ${Kb.Styles.globalColors.white} 75%)`},
      }),
    }) as const
)

export default JumpToRecent
