import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as Container from '../../../../util/container'
import type * as Chat2Types from '../../../../constants/types/chat2'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'

type Props = {
  conversationIDKey: Chat2Types.ConversationIDKey
}

const MakeTeam = ({conversationIDKey}: Props) => {
  const dispatch = Container.useDispatch()
  const onShowNewTeamDialog = () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {conversationIDKey}, selected: 'chatShowNewTeamDialog'}],
      })
    )
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
              color={Styles.globalColors.greenLight}
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
      },
      link: {color: Styles.isMobile ? Styles.globalColors.greenLight : undefined},
      textContainer: {padding: Styles.globalMargins.medium},
    } as const)
)

export default MakeTeam
