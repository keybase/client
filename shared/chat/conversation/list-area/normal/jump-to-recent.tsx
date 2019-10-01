import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

type Props = {
  onClick: () => void
  style?: Styles.StylesCrossPlatform
}

const JumpToRecent = (props: Props) => {
  return (
    <Kb.Box2 direction="vertical" style={Styles.collapseStyles([styles.outerContainer, props.style])}>
      <Kb.Button label="Jump to recent messages" onClick={props.onClick} small={true} style={styles.button}>
        <Kb.Icon
          color={Styles.globalColors.white}
          type="iconfont-arrow-full-down"
          boxStyle={styles.arrowBox}
          sizeType="Small"
          style={Kb.iconCastPlatformStyles(styles.arrowText)}
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
      outerContainer: {
        alignItems: 'center',
        paddingBottom: Styles.globalMargins.small,
        paddingTop: Styles.globalMargins.small,
        width: '100%',
      },
    } as const)
)

export default JumpToRecent
