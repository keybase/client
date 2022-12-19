import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import openUrl from '../../../../util/open-url'

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

const NewCard = (outerProps: Props) => {
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
      style={Styles.collapseStyles([styles.container, props.tall ? styles.containerTall : null])}
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
              color={Styles.globalColors.blueLighter}
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
        style={Styles.collapseStyles([styles.image, props.imageLower ? styles.imageLower : null])}
      />
    </Kb.Box2>
  )
}

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
      containerTall: Styles.platformStyles({
        isElectron: {
          height: 119,
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
      imageLower: {
        marginLeft: Styles.isMobile ? -65 : undefined,
        marginTop: Styles.isMobile ? -20 : 39,
      },
      link: {color: Styles.isMobile ? Styles.globalColors.blueLighter : undefined},
      textContainer: {padding: Styles.globalMargins.medium},
    } as const)
)

export default NewCard
