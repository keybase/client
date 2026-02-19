import * as Kb from '@/common-adapters'

export type Props = {
  onReadMore: () => void
  onHideChatBanner: () => void
}

const Banner = ({onReadMore, onHideChatBanner}: Props) => (
  <Kb.Box2 direction={Kb.Styles.isMobile ? 'vertical' : 'horizontal'} alignItems="center" fullWidth={true} style={styles.containerBanner}>
    <Kb.Icon
      style={styles.illustration}
      type={Kb.Styles.isMobile ? 'icon-illustration-teams-216' : 'icon-illustration-teams-180'}
    />
    <Kb.Box2 direction="vertical" style={styles.containerHeader}>
      <Kb.Text3 negative={true} type="Header" style={styles.header}>
        Create a team on Keybase
      </Kb.Text3>
      <Kb.Text3 center={Kb.Styles.isMobile} negative={true} type="BodySmallSemibold" style={styles.text}>
        Keybase team chats are encrypted - unlike Slack - and work for any size group, from casual friends to
        large communities.
      </Kb.Text3>
      <Kb.Text3 negative={true} type="BodySmallSemiboldPrimaryLink" className="underline" onClick={onReadMore}>
        Read more
      </Kb.Text3>
    </Kb.Box2>
    <Kb.Box2 direction="vertical" style={styles.closeIconContainer}>
      <Kb.Icon
        type="iconfont-close"
        style={{padding: Kb.Styles.globalMargins.xtiny}}
        onClick={onHideChatBanner}
      />
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  closeIconContainer: Kb.Styles.platformStyles({
    common: {
      position: 'absolute',
    },
    isElectron: {
      right: Kb.Styles.globalMargins.tiny,
      top: Kb.Styles.globalMargins.tiny,
    },
    isMobile: {
      height: 26,
      right: Kb.Styles.globalMargins.small,
      top: Kb.Styles.globalMargins.small,
      width: 26,
    },
  }),
  containerBanner: Kb.Styles.platformStyles({
    common: {
      backgroundColor: Kb.Styles.globalColors.blue,
      flexShrink: 0,
      position: 'relative',
    },
    isElectron: {
      height: 212,
      justifyContent: 'flex-start',
      paddingRight: Kb.Styles.globalMargins.large,
    },
    isMobile: {
      justifyContent: 'center',
      padding: 24,
    },
  }),
  containerHeader: Kb.Styles.platformStyles({
    isElectron: {
      maxWidth: 360,
    },
    isMobile: {
      alignItems: 'center',
    },
  }),
  header: {
    marginBottom: 15,
    marginTop: 15,
  },
  illustration: Kb.Styles.platformStyles({
    isElectron: {
      paddingLeft: Kb.Styles.globalMargins.large,
      paddingRight: Kb.Styles.globalMargins.large,
    },
  }),
  text: Kb.Styles.platformStyles({
    common: {
      marginBottom: Kb.Styles.globalMargins.small,
    },
  }),
}))

export default Banner
