import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

type Props = {}

const HelloBot = (_: Props) => (
  <Kb.Box2 direction="horizontal" style={styles.container} alignItems="flex-start">
    <Kb.Icon type="icon-fancy-hellobot-hi-96" style={styles.image} />
    <Kb.Box2 direction="vertical" gap="xtiny" fullHeight={true} style={styles.textContainer}>
      <Kb.Text type="BodySmallSemibold" style={styles.header} negative={true}>
        Hi, I'm Hello Bot. You can play puzzles with me or ask for help.
      </Kb.Text>
      <Kb.Text type="BodySmallSemibold" style={styles.header} negative={true}>
        Everyday is an adventure.
      </Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.orange,
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
      image: Styles.platformStyles({
        common: {
          marginLeft: Styles.globalMargins.medium,
        },
        isElectron: {
          marginTop: -Styles.globalMargins.xsmall,
        },
        isMobile: {
          alignSelf: 'center',
          marginTop: Styles.globalMargins.tiny,
        },
      }),
      link: {color: Styles.isMobile ? Styles.globalColors.blueLighter : undefined},
      textContainer: {padding: Styles.globalMargins.medium},
    } as const)
)

export default HelloBot
