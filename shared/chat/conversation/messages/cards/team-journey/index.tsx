import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import type * as ChatTypes from '../../../../../constants/types/chat2'

export type Action =
  | {
      label: string
      onClick: () => void
    }
  | 'wave'

export type Mode = 'chat' | 'team-settings'

type Props = {
  actions: Array<Action>
  conversationIDKey: ChatTypes.ConversationIDKey
  image: Kb.IconType | null
  onAuthorClick: () => void
  onDismiss: () => void
  teamname: string
  textComponent: React.ReactNode
  deactivateButtons?: boolean
  mode: Mode
}

export const TeamJourney = (props: Props) => {
  const {conversationIDKey, teamname, mode} = props

  const contentHorizontalPadStyle =
    mode === 'chat'
      ? (styles.contentHorizontalPadChat as Styles.StylesCrossPlatform)
      : styles.contentHorizontalPadTeamSettings

  return (
    <>
      <TeamJourneyHeader
        teamname={teamname}
        onAuthorClick={props.onAuthorClick}
        onDismiss={props.onDismiss}
        deactivateButtons={props.deactivateButtons}
        mode={mode}
      />
      <Kb.Box2
        key="content"
        direction="vertical"
        fullWidth={true}
        style={Styles.collapseStyles([styles.content, props.image ? styles.contentWithImage : null])}
      >
        <Kb.Box2 direction="horizontal" fullWidth={true} style={contentHorizontalPadStyle}>
          <Kb.Box2 direction="horizontal" style={props.image ? styles.text : undefined}>
            {props.textComponent}
          </Kb.Box2>
          {!!props.image && (
            <Kb.Icon
              style={
                props.mode === 'team-settings'
                  ? (styles.imageSettingsTab as Styles.StylesCrossPlatform)
                  : styles.image
              }
              type={props.image}
            />
          )}
        </Kb.Box2>
        <Kb.ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
          <Kb.Box2
            direction="horizontal"
            fullWidth={true}
            alignItems={'flex-start'}
            gap="tiny"
            style={Styles.collapseStyles([styles.actionsBox, contentHorizontalPadStyle] as const)}
          >
            {props.actions.map(action =>
              action == 'wave' ? (
                <Kb.WaveButton
                  key="wave"
                  conversationIDKey={conversationIDKey}
                  small={true}
                  style={styles.buttonSpace}
                  disabled={!!props.deactivateButtons}
                />
              ) : (
                <Kb.Button
                  key={action.label}
                  small={true}
                  type="Default"
                  mode="Secondary"
                  label={action.label}
                  onClick={action.onClick}
                  disabled={!!props.deactivateButtons}
                  style={styles.buttonSpace}
                />
              )
            )}
          </Kb.Box2>
        </Kb.ScrollView>
      </Kb.Box2>
    </>
  )
}

type HeaderProps = {
  teamname: string
  onAuthorClick: () => void
  onDismiss: () => void
  deactivateButtons?: boolean
  mode: 'chat' | 'team-settings'
}
const TeamJourneyHeader = (props: HeaderProps) => {
  const avatarStyle = props.mode === 'chat' ? styles.avatarChat : styles.avatarTeamSettings
  return (
    <Kb.Box2 key="author" direction="horizontal" fullWidth={true} style={styles.authorContainer} gap="tiny">
      <Kb.Avatar
        size={32}
        isTeam={true}
        teamname={props.teamname}
        skipBackground={true}
        style={avatarStyle}
        onClick={props.deactivateButtons ? undefined : props.onAuthorClick}
      />
      <Kb.Box2
        direction="horizontal"
        gap="xtiny"
        fullWidth={false}
        alignSelf="flex-start"
        style={styles.bottomLine}
      >
        <Kb.Text
          style={styles.teamnameText}
          type="BodySmallBold"
          onClick={props.deactivateButtons ? undefined : props.onAuthorClick}
          className={props.deactivateButtons ? '' : 'hover-underline'}
        >
          {props.teamname}
        </Kb.Text>
        <Kb.Text type="BodyTiny">• System message</Kb.Text>
      </Kb.Box2>
      {!Styles.isMobile && !props.deactivateButtons && (
        <Kb.Icon type="iconfont-close" onClick={props.onDismiss} fontSize={12} />
      )}
    </Kb.Box2>
  )
}

const buttonSpace = 6

const styles = Styles.styleSheetCreate(
  () =>
    ({
      actionsBox: Styles.platformStyles({
        common: {
          marginTop: Styles.globalMargins.tiny - buttonSpace,
        },
        isElectron: {
          flexWrap: 'wrap',
        },
      }),
      authorContainer: Styles.platformStyles({
        common: {
          alignItems: 'flex-start',
          alignSelf: 'flex-start',
          height: Styles.globalMargins.mediumLarge,
        },
        isMobile: {marginTop: 8},
      }),
      avatarChat: Styles.platformStyles({
        isElectron: {
          marginLeft: Styles.globalMargins.small,
          marginTop: Styles.globalMargins.xtiny,
        },
        isMobile: {marginLeft: Styles.globalMargins.tiny},
      }),
      avatarTeamSettings: Styles.platformStyles({
        isElectron: {
          marginLeft: Styles.globalMargins.tiny,
          marginTop: 0,
        },
        isMobile: {marginLeft: Styles.globalMargins.xtiny},
      }),
      bottomLine: {
        ...Styles.globalStyles.flexGrow,
        alignItems: 'baseline',
      },
      buttonSpace: {
        marginTop: buttonSpace,
      },
      content: Styles.platformStyles({
        isElectron: {
          marginTop: -16,
        },
        isMobile: {
          marginTop: -12,
          paddingBottom: 3,
        },
      }),
      contentHorizontalPadChat: Styles.platformStyles({
        isElectron: {
          paddingLeft:
            // Space for below the avatar
            Styles.globalMargins.tiny + // right margin
            Styles.globalMargins.small + // left margin
            Styles.globalMargins.mediumLarge, // avatar
          paddingRight: Styles.globalMargins.tiny,
        },
        isMobile: {
          paddingLeft:
            // Space for below the avatar
            Styles.globalMargins.tiny + // right margin
            Styles.globalMargins.tiny + // left margin
            Styles.globalMargins.mediumLarge, // avatar
        },
      }),
      contentHorizontalPadTeamSettings: Styles.platformStyles({
        isElectron: {
          paddingLeft:
            // Space for below the avatar
            Styles.globalMargins.tiny + // right margin
            Styles.globalMargins.tiny + // left margin
            Styles.globalMargins.mediumLarge, // avatar
          paddingRight: Styles.globalMargins.tiny,
        },
        isMobile: {
          paddingLeft:
            // Space for below the avatar
            Styles.globalMargins.tiny + // right margin
            Styles.globalMargins.tiny + // left margin
            Styles.globalMargins.mediumLarge, // avatar
        },
      }),
      contentWithImage: {
        minHeight: 70,
      },
      image: Styles.platformStyles({
        common: {
          position: 'absolute',
          top: 0,
        },
        isElectron: {
          left: '50%',
          marginLeft: 15,
        },
        isMobile: {
          right: 40,
        },
      }),
      imageSettingsTab: Styles.platformStyles({
        common: {
          position: 'absolute',
          top: 0,
        },
        isElectron: {
          left: '50%',
          marginLeft: 15,
        },
        isMobile: {
          right: 25,
        },
      }),
      teamnameText: Styles.platformStyles({
        common: {
          color: Styles.globalColors.black,
        },
      }),
      text: {
        maxWidth: '45%',
      },
    } as const)
)

export default TeamJourney
