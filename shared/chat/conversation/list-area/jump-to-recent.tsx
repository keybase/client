import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {
  onClick: () => void
  style?: Styles.StylesCrossPlatform
}

const JumpToRecent = (props: Props) => {
  return (
    <Kb.Box2 direction="vertical" style={Styles.collapseStyles([styles.outerContainer, props.style])}>
      <Kb.Button label="Jump to recent messages" onClick={props.onClick} small={true}>
        <Kb.Icon
          color={Styles.globalColors.whiteOrWhite}
          type="iconfont-arrow-full-down"
          boxStyle={styles.arrowBox}
          sizeType="Small"
          style={styles.arrowText}
        />
      </Kb.Button>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      arrowBox: Styles.platformStyles({
        isElectron: {
          display: 'inline',
        },
      }),
      arrowText: {
        paddingRight: Styles.globalMargins.tiny,
      },
      outerContainer: Styles.platformStyles({
        common: {
          alignItems: 'center',
          paddingBottom: Styles.globalMargins.small,
          paddingTop: Styles.globalMargins.small,
          width: '100%',
        },
        isElectron: {
          backgroundImage: `linear-gradient(transparent, ${Styles.globalColors.white} 75%)`,
        },
      }),
    } as const)
)

export default JumpToRecent
