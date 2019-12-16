import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import openUrl from '../../../../util/open-url'

type Props = {}

const NewCard = (_: Props) => (
  <Kb.Box2 direction="horizontal" style={styles.container} alignItems="flex-start">
    <Kb.Box2 direction="vertical" gap="xtiny" fullHeight={true} style={styles.textContainer}>
      <Kb.Text type="BodySmallSemibold" style={styles.header} negative={true}>
        This conversation is end-to-end encrypted.
      </Kb.Text>
      <Kb.ClickableBox onClick={() => openUrl('https://keybase.io/docs/chat/crypto')}>
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
            className="color_blueLighterOrWhite hover_contained_color_white"
          >
            Read more
          </Kb.Text>
          <Kb.Icon
            color={Styles.globalColors.blueLighterOrWhite}
            sizeType="Tiny"
            type="iconfont-arrow-right"
            className="hover_contained_color_white"
            style={styles.icon}
          />
        </Kb.Box2>
      </Kb.ClickableBox>
    </Kb.Box2>
    <Kb.Icon type="icon-illustration-encrypted-116-96" style={styles.image} />
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.blueDark,
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
        alignSelf: Styles.isMobile ? 'center' : undefined,
        marginTop: Styles.isMobile ? Styles.globalMargins.tiny : -Styles.globalMargins.xsmall,
        paddingRight: Styles.globalMargins.medium,
      },
      link: {color: Styles.isMobile ? Styles.globalColors.blueLighter : undefined},
      textContainer: {padding: Styles.globalMargins.medium},
    } as const)
)

export default NewCard
