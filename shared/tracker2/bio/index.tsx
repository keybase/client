import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import flags from '../../util/feature-flags'

export type Props = {
  airdropIsLive: boolean | null
  bio: string | null
  followThem: boolean | null
  followersCount: number | null
  followingCount: number | null
  followsYou: boolean | null
  fullname: string | null
  inTracker: boolean
  location: string | null
  onBack?: () => void
  onLearnMore?: () => void
  registeredForAirdrop: boolean | null
  youAreInAirdrop: boolean | null
  sbsDescription: string | null
}

// Here we're using FloatingMenu, but we want to customize the button to match
// Zeplin, so there's a hack -- desktop renders everything as a custom header,
// whereas mobile uses `items` prop as normal.
type AirdropPopupProps = {
  onBack?: () => void
  onLearnMore?: () => void
}

const _AirdropPopup = (p: Kb.PropsWithOverlay<AirdropPopupProps>) => (
  <Kb.ClickableBox
    ref={p.setAttachmentRef}
    onClick={p.toggleShowingMenu}
    onMouseEnter={p.toggleShowingMenu}
    onMouseLeave={p.toggleShowingMenu}
  >
    <Kb.Icon color={Styles.globalColors.yellowDark} type="iconfont-identity-stellar" style={styles.star} />
    <Kb.FloatingMenu
      attachTo={p.getAttachmentRef}
      closeOnSelect={true}
      containerStyle={styles.floatingContainer}
      listStyle={styles.floatingContainer}
      backgroundColor={Styles.globalColors.purple}
      textColor={Styles.globalColors.white}
      onHidden={p.toggleShowingMenu}
      visible={p.showingMenu}
      propagateOutsideClicks={true}
      header={{
        title: 'header',
        view: (
          <Kb.Box2
            direction="vertical"
            centerChildren={true}
            fullWidth={true}
            gap="tiny"
            style={{backgroundColor: Styles.globalColors.purple, padding: Styles.globalMargins.small}}
          >
            <Kb.Icon type="icon-airdrop-logo-64" style={styles.star} />
            <Kb.Text style={styles.airdropText} type="BodySemibold">
              Join the airdrop
            </Kb.Text>
            <Kb.Text style={styles.airdropText} type="BodySmall">
              Airdropees get free Lumens every month.
            </Kb.Text>
            {!Styles.isMobile && (
              <Kb.Button
                backgroundColor="purple"
                label="Learn more"
                onClick={p.onLearnMore}
                style={styles.learnButton}
              />
            )}
          </Kb.Box2>
        ),
      }}
      items={
        Styles.isMobile
          ? [
              'Divider',
              {
                onClick: p.onLearnMore,
                title: 'Learn more',
              },
            ]
          : []
      }
    />
  </Kb.ClickableBox>
)
const AirdropPopup = Kb.OverlayParentHOC(_AirdropPopup)

const FollowText = ({followThem, followsYou}) => {
  let text: string = ''
  if (followThem) {
    if (followsYou) {
      text = 'YOU FOLLOW EACH OTHER'
    } else {
      text = 'YOU FOLLOW THEM'
    }
  } else if (followsYou) {
    text = 'FOLLOWS YOU'
  }
  return text ? <Kb.Text type="BodySmall">{text}</Kb.Text> : null
}

const Bio = (p: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container} centerChildren={true} gap="xtiny">
    <Kb.Box2 direction="horizontal" style={styles.fullNameContainer} gap="tiny">
      <Kb.Text type="BodyBig" lineClamp={p.inTracker ? 1 : undefined} selectable={true}>
        {p.fullname}
      </Kb.Text>
      {flags.airdrop &&
        p.airdropIsLive &&
        p.registeredForAirdrop &&
        (p.youAreInAirdrop ? (
          <Kb.WithTooltip text="Lucky airdropee">
            <Kb.Icon
              color={Styles.globalColors.yellowDark}
              type="iconfont-identity-stellar"
              style={styles.star}
            />
          </Kb.WithTooltip>
        ) : (
          <AirdropPopup onBack={p.onBack} onLearnMore={p.onLearnMore} />
        ))}
    </Kb.Box2>
    <FollowText followThem={p.followThem} followsYou={p.followsYou} />
    {p.followersCount !== null && (
      <Kb.Text type="BodySmall">
        <Kb.Text type="BodySmall">
          <Kb.Text type="BodySmall" style={styles.bold}>
            {p.followersCount}
          </Kb.Text>{' '}
          Followers{' '}
        </Kb.Text>
        <Kb.Text type="BodySmall"> · </Kb.Text>
        <Kb.Text type="BodySmall">
          {' '}
          Following{' '}
          <Kb.Text type="BodySmall" style={styles.bold}>
            {p.followingCount}{' '}
          </Kb.Text>
        </Kb.Text>
      </Kb.Text>
    )}
    {!!p.bio && (
      <Kb.Text
        type="Body"
        center={true}
        lineClamp={p.inTracker ? 2 : undefined}
        style={styles.text}
        selectable={true}
      >
        {p.bio}
      </Kb.Text>
    )}
    {!!p.location && (
      <Kb.Text
        type="BodySmall"
        center={true}
        lineClamp={p.inTracker ? 1 : undefined}
        style={styles.text}
        selectable={true}
      >
        {p.location}
      </Kb.Text>
    )}
    {!!p.sbsDescription && (
      <Kb.Text
        type="BodySmall"
        center={true}
        lineClamp={p.inTracker ? 1 : undefined}
        style={styles.text}
        selectable={true}
      >
        {p.sbsDescription}
      </Kb.Text>
    )}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  airdropText: Styles.platformStyles({
    common: {color: Styles.globalColors.white},
    isElectron: {textAlign: 'center'},
  }),
  bold: {...Styles.globalStyles.fontBold},
  container: {backgroundColor: Styles.globalColors.white, flexShrink: 0},
  floatingContainer: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.purple,
    },
    isElectron: {
      maxWidth: 200,
    },
  }),
  fullName: Styles.platformStyles({
    isElectron: {wordBreak: 'break-any'},
  }),
  fullNameContainer: {
    paddingLeft: Styles.globalMargins.mediumLarge,
    paddingRight: Styles.globalMargins.mediumLarge,
  },
  learnButton: {alignSelf: 'center', marginTop: Styles.globalMargins.tiny},
  star: {alignSelf: 'center', marginBottom: Styles.globalMargins.tiny},
  text: Styles.platformStyles({
    common: {
      paddingLeft: Styles.globalMargins.mediumLarge,
      paddingRight: Styles.globalMargins.mediumLarge,
    },
    isElectron: {
      wordBreak: 'break-word',
    },
    isMobile: {
      lineHeight: 21,
    },
  }),
})

export default Bio
