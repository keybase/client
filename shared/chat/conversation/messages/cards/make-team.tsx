import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'

const MakeTeam = () => {
  const navigateAppend = Chat.useChatNavigateAppend()
  const onShowNewTeamDialog = () =>
    navigateAppend(conversationIDKey => ({props: {conversationIDKey}, selected: 'chatShowNewTeamDialog'}))
  return (
    <Kb.Box2 direction="horizontal" style={styles.container} alignItems="flex-start">
      <Kb.Box2 direction="vertical" gap="xtiny" fullHeight={true} style={styles.textContainer}>
        <Kb.Text type="BodySmallSemibold" style={styles.header} negative={true}>
          Make it a team? You’ll be able to add and delete members as you wish.
        </Kb.Text>
        <Kb.ClickableBox onClick={onShowNewTeamDialog}>
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
              className="color_greenLightOrWhite hover_contained_color_white"
            >
              Enter a team name
            </Kb.Text>
            <Kb.Icon
              color={Kb.Styles.globalColors.greenLight}
              sizeType="Tiny"
              type="iconfont-arrow-right"
              className="hover_contained_color_white"
              style={styles.icon}
            />
          </Kb.Box2>
        </Kb.ClickableBox>
      </Kb.Box2>
      <Kb.Icon type="icon-illustration-teams-80" style={styles.image} />
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.green,
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
      image: {
        alignSelf: 'center',
        paddingRight: Kb.Styles.globalMargins.small,
      },
      link: {color: Kb.Styles.isMobile ? Kb.Styles.globalColors.greenLight : undefined},
      textContainer: {padding: Kb.Styles.globalMargins.medium},
    }) as const
)

export default MakeTeam
