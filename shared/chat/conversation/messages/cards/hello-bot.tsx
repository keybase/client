import * as Kb from '@/common-adapters'

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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.orange,
          borderRadius: Kb.Styles.borderRadius,
        },
        isElectron: {
          height: 100,
          marginTop: Kb.Styles.globalMargins.xsmall,
          maxWidth: 400,
        },
        isMobile: {
          marginLeft: Kb.Styles.globalMargins.small,
          marginRight: Kb.Styles.globalMargins.small,
          marginTop: Kb.Styles.globalMargins.small,
          width: 288,
        },
      }),
      header: {
        maxWidth: Kb.Styles.isMobile ? 126 : undefined,
      },
      icon: Kb.Styles.platformStyles({
        isElectron: {
          display: 'block',
          marginTop: 4,
        },
      }),
      image: Kb.Styles.platformStyles({
        common: {
          marginLeft: Kb.Styles.globalMargins.medium,
        },
        isElectron: {
          marginTop: -Kb.Styles.globalMargins.xsmall,
        },
        isMobile: {
          alignSelf: 'center',
          marginTop: Kb.Styles.globalMargins.tiny,
        },
      }),
      link: {color: Kb.Styles.isMobile ? Kb.Styles.globalColors.blueLighter : undefined},
      textContainer: {padding: Kb.Styles.globalMargins.medium},
    }) as const
)

export default HelloBot
