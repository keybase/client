import * as React from 'react'
import * as Kb from '@/common-adapters'
import openUrl from '@/util/open-url'

type Props = {
  self: boolean
  openPrivateFolder: () => void
}

type InnerProps = {
  action: () => void
  icon: Kb.IconType
  imageLower?: boolean
  label: string
  tall?: boolean
  text: string
}

const NewCard = React.memo(function NewCard(outerProps: Props) {
  const iconEncrypted: Kb.IconType = 'icon-illustration-encrypted-116-96'
  const iconSecure: Kb.IconType = 'icon-illustration-secure-116-96'
  const props: InnerProps = outerProps.self
    ? {
        action: outerProps.openPrivateFolder,
        icon: iconSecure,
        imageLower: true,
        label: 'Open your private folder',
        tall: true,
        text: 'Use this chat to store secure notes such as credit card numbers, passwords, or secret keys.',
      }
    : {
        action: () => openUrl('https://book.keybase.io/docs/chat/crypto'),
        icon: iconEncrypted,
        label: 'Read more',
        text: 'This conversation is end-to-end encrypted.',
      }
  return (
    <Kb.Box2
      direction="horizontal"
      style={Kb.Styles.collapseStyles([styles.container, props.tall ? styles.containerTall : null])}
      alignItems="flex-start"
    >
      <Kb.Box2 direction="vertical" gap="xtiny" fullHeight={true} style={styles.textContainer}>
        <Kb.Text type="BodySmallSemibold" style={styles.header} negative={true}>
          {props.text}
        </Kb.Text>
        <Kb.ClickableBox onClick={props.action}>
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
              {props.label}
            </Kb.Text>
            <Kb.Icon
              color={Kb.Styles.globalColors.blueLighter}
              sizeType="Tiny"
              type="iconfont-arrow-right"
              className="hover_contained_color_white"
              style={styles.icon}
            />
          </Kb.Box2>
        </Kb.ClickableBox>
      </Kb.Box2>
      <Kb.Icon
        type={props.icon}
        style={Kb.Styles.collapseStyles([styles.image, props.imageLower ? styles.imageLower : null])}
      />
    </Kb.Box2>
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.blueDark,
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
      containerTall: Kb.Styles.platformStyles({
        isElectron: {
          height: 119,
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
      image: {
        alignSelf: Kb.Styles.isMobile ? 'center' : undefined,
        marginTop: Kb.Styles.isMobile ? Kb.Styles.globalMargins.tiny : -Kb.Styles.globalMargins.xsmall,
        paddingRight: Kb.Styles.globalMargins.medium,
      },
      imageLower: {
        marginLeft: Kb.Styles.isMobile ? -65 : undefined,
        marginTop: Kb.Styles.isMobile ? -20 : 39,
      },
      link: {color: Kb.Styles.isMobile ? Kb.Styles.globalColors.blueLighter : undefined},
      textContainer: {padding: Kb.Styles.globalMargins.medium},
    }) as const
)

export default NewCard
