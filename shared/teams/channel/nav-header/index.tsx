import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import TeamMenu from '../menu-container'
import {TeamID} from '../../../constants/types/teams'
import {pluralize} from '../../../util/string'
import capitalize from 'lodash/capitalize'
import flags from '../../../util/feature-flags'

type HeaderTitleProps = {
  active: boolean
  canAddMembers: boolean
  canChat: boolean
  canEdit: boolean
  channelName: string
  conversationIDKey: ChatTypes.ConversationIDKey
  description: string
  loading: boolean
  memberCount: number
  newMemberCount?: string
  onChat: () => void
  role: string
  teamID: TeamID
  teamname: string
} & Kb.OverlayParentProps

const _HeaderTitle = (props: HeaderTitleProps) => {
  const avatar = (
    <Kb.Avatar editable={false} teamname={props.teamname} size={16} style={styles.alignSelfFlexStart} />
  )

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onBack = () => dispatch(nav.safeNavigateUpPayload())
  return Styles.isMobile ? (
    <Kb.Box2 alignItems="flex-start" direction="vertical" fullWidth={true} style={styles.backButton}>
      <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="flex-start">
        <Kb.BackButton onClick={onBack} />
      </Kb.Box2>
      <Kb.Box2 direction="vertical" fullWidth={true} gap="small" style={styles.outerBoxMobile}>
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
          {/* TODO: add stuff */}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  ) : (
    <Kb.Box2
      alignItems="center"
      direction="horizontal"
      gap="small"
      gapStart={true}
      fullWidth={true}
      className="headerTitle"
    >
      {avatar}
      <Kb.Box2
        direction="vertical"
        alignItems="flex-start"
        alignSelf="flex-start"
        style={styles.flexShrinkGrow}
      ></Kb.Box2>
    </Kb.Box2>
  )
}

export default Kb.OverlayParentHOC(_HeaderTitle)

type SubHeaderProps = {
  onAddSelf: (() => void) | null
}

export const SubHeader = (props: SubHeaderProps) =>
  props.onAddSelf ? (
    <Kb.Box2 direction="horizontal" style={styles.banner} fullWidth={true}>
      <Kb.Banner color="blue" inline={true}>
        <Kb.BannerParagraph
          bannerColor="red"
          content={[
            'You are not a member of this team. ',
            {onClick: props.onAddSelf, text: 'Add yourself'},
            '?',
          ]}
        />
      </Kb.Banner>
    </Kb.Box2>
  ) : null

const styles = Styles.styleSheetCreate(
  () =>
    ({
      addPeopleButton: {
        flexGrow: 0,
      },
      addSelfLink: {
        marginLeft: Styles.globalMargins.xtiny,
        textDecorationLine: 'underline',
      },
      alignSelfFlexStart: {
        alignSelf: 'flex-start',
      },
      backButton: {
        backgroundColor: Styles.globalColors.white,
        paddingTop: Styles.globalMargins.small,
      },
      banner: {
        ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.xsmall, 0),
      },
      clickable: Styles.platformStyles({
        isElectron: {
          ...Styles.desktopStyles.windowDraggingClickable,
        },
      }),
      flexShrink: {
        flexShrink: 1,
      },
      flexShrinkGrow: {
        flexGrow: 1,
        flexShrink: 1,
      },
      greenText: {
        color: Styles.globalColors.greenDark,
      },
      header: {
        flexShrink: 1,
      },
      marginBottomRightTiny: {
        marginBottom: Styles.globalMargins.tiny,
        marginRight: Styles.globalMargins.tiny,
      },
      openMeta: Styles.platformStyles({
        isElectron: {
          alignSelf: 'center',
          marginLeft: Styles.globalMargins.xtiny,
        },
        isMobile: {alignSelf: 'flex-start'},
      }),
      outerBoxMobile: {
        ...Styles.padding(Styles.globalMargins.small),
        backgroundColor: Styles.globalColors.white,
      },
      rightActionsContainer: Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
          paddingTop: Styles.globalMargins.tiny,
        },
        isElectron: Styles.desktopStyles.windowDraggingClickable,
      }),
    } as const)
)
