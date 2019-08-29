import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import openUrl from '../../../../util/open-url'

type Props = {}

const NewCard = (_: Props) => (
  <Kb.Box2 direction="horizontal" style={styles.container} alignItems="flex-start">
    <Kb.Box2 direction="vertical" gap="xtiny" fullHeight={true} style={styles.textContainer}>
      <Kb.Text type="BodySemibold" style={styles.header}>
        This conversation is end-to-end encrypted.
      </Kb.Text>
      <Kb.ClickableBox onClick={() => openUrl('https://keybase.io/docs/chat/crypto')}>
        <Kb.Box2
          direction="horizontal"
          alignItems="flex-end"
          fullWidth={true}
          className="hover_container"
          gap="xtiny"
        >
          <Kb.Text
            type="BodyPrimaryLink"
            style={styles.link}
            className="color_blueLighter hover_contained_color_white"
          >
            Read more
          </Kb.Text>
          <Kb.Icon
            color={Styles.globalColors.blueLighter}
            type="iconfont-arrow-right"
            className="hover_contained_color_white"
            style={Kb.iconCastPlatformStyles(styles.icon)}
          />
        </Kb.Box2>
      </Kb.ClickableBox>
    </Kb.Box2>
    <Kb.Icon type="icon-illustration-encrypted-116-96" style={styles.image} />
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(() => ({
  container: {
    backgroundColor: Styles.globalColors.blueDark,
    borderRadius: Styles.borderRadius,
    height: Styles.isMobile ? undefined : 100,
    maxWidth: Styles.isMobile ? '80%' : 400,
    overflow: 'hidden',
  },
  header: {color: Styles.globalColors.white},
  icon: {fontSize: 12},
  image: {
    paddingRight: Styles.globalMargins.medium,
    paddingTop: Styles.isMobile ? Styles.globalMargins.tiny : Styles.globalMargins.xsmall,
  },
  link: {color: Styles.isMobile ? Styles.globalColors.blueLighter : undefined},
  textContainer: {padding: Styles.globalMargins.medium},
}))

export default NewCard
