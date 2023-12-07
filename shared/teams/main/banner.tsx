import * as Kb from '@/common-adapters'

export type Props = {
  onReadMore: () => void
  onHideChatBanner: () => void
}

const Banner = ({onReadMore, onHideChatBanner}: Props) => (
  <Kb.Box style={styles.containerBanner}>
    <Kb.Icon
      style={styles.illustration}
      type={Kb.Styles.isMobile ? 'icon-illustration-teams-216' : 'icon-illustration-teams-180'}
    />
    <Kb.Box style={styles.containerHeader}>
      <Kb.Text negative={true} type="Header" style={styles.header}>
        Create a team on Keybase
      </Kb.Text>
      <Kb.Text center={Kb.Styles.isMobile} negative={true} type="BodySmallSemibold" style={styles.text}>
        Keybase team chats are encrypted - unlike Slack - and work for any size group, from casual friends to
        large communities.
      </Kb.Text>
      <Kb.Text negative={true} type="BodySmallSemiboldPrimaryLink" className="underline" onClick={onReadMore}>
        Read more
      </Kb.Text>
    </Kb.Box>
    <Kb.Box style={styles.closeIconContainer}>
      <Kb.Icon
        type="iconfont-close"
        style={{padding: Kb.Styles.globalMargins.xtiny}}
        onClick={onHideChatBanner}
      />
    </Kb.Box>
  </Kb.Box>
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  closeIcon: {
    padding: Kb.Styles.globalMargins.xtiny,
  },
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
      alignItems: 'center',
      backgroundColor: Kb.Styles.globalColors.blue,
      flexShrink: 0,
      position: 'relative',
      width: '100%',
    },
    isElectron: {
      ...Kb.Styles.globalStyles.flexBoxRow,
      height: 212,
      justifyContent: 'flex-start',
      paddingRight: Kb.Styles.globalMargins.large,
    },
    isMobile: {
      ...Kb.Styles.globalStyles.flexBoxColumn,
      justifyContent: 'center',
      padding: 24,
    },
  }),
  containerHeader: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.globalStyles.flexBoxColumn,
    },
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
