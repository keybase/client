import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

type Props = {}

const MakeTeam = (_: Props) => (
  <Kb.Box2 direction="horizontal" style={styles.container} alignItems="flex-start">
    <Kb.Box2 direction="vertical" gap="xtiny" fullHeight={true} style={styles.textContainer}>
      <Kb.Text type="BodySmallSemibold" style={styles.header} negative={true}>
        Make it a team? You’ll be able to add and delete members as you wish.
      </Kb.Text>
      <Kb.ClickableBox onClick={() => null}>
        <Kb.Box2
          direction="horizontal"
          alignItems="center"
          fullWidth={true}
          className="hover_container"
          gap="xtiny"
        >
          <Kb.Text
            type="BodySmallSemiboldPrimaryLink"
            style={styles.link}
            className="color_greenLight hover_contained_color_white"
          >
            Enter a teamname
          </Kb.Text>
          <Kb.Icon
            color={Styles.globalColors.greenLight}
            sizeType="Tiny"
            type="iconfont-arrow-right"
            className="hover_contained_color_white"
            style={Kb.iconCastPlatformStyles(styles.icon)}
          />
        </Kb.Box2>
      </Kb.ClickableBox>
    </Kb.Box2>
    <Kb.Icon type="icon-illustration-teams-180" style={styles.image} />
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.green,
          borderRadius: Styles.borderRadius,
        },
        isElectron: {
          height: 100,
          marginTop: Styles.globalMargins.xsmall,
          maxWidth: 400,
        },
        isMobile: {
          marginLeft: Styles.globalMargins.small,
          marginRight: Styles.globalMargins.small,
          marginTop: Styles.globalMargins.small,
          width: 288,
        },
      }),
      header: {
        maxWidth: Styles.isMobile ? 126 : undefined,
      },
      icon: Styles.platformStyles({
        isElectron: {
          display: 'block',
          marginTop: 4,
        },
      }),
      image: {
        alignSelf: 'center',
        paddingRight: Styles.globalMargins.small,
        height: 80,
      },
      link: {color: Styles.isMobile ? Styles.globalColors.blueLighter : undefined},
      textContainer: {padding: Styles.globalMargins.medium},
    } as const)
)

export default MakeTeam
