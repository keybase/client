import * as Kb from '@/common-adapters'

export type Props = {
  onReadMore: () => void
  onHideChatBanner: () => void
}

const Banner = ({onReadMore, onHideChatBanner}: Props) => {
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  return (
    <Kb.Box2 direction={isMobile ? 'vertical' : 'horizontal'} alignItems="center" fullWidth={true} relative={true} style={styles.containerBanner}>
      <Kb.ImageIcon
        style={styles.illustration}
        type={isMobile ? 'icon-illustration-teams-216' : 'icon-illustration-teams-180'}
      />
      <Kb.Box2 direction="vertical" style={styles.containerHeader}>
        <Kb.Text negative={true} type="Header" style={styles.header}>
          Create a team on Keybase
        </Kb.Text>
        <Kb.Text center={isMobile} negative={true} type="BodySmallSemibold" style={styles.text}>
          Keybase team chats are encrypted - unlike Slack - and work for any size group, from casual friends to
          large communities.
        </Kb.Text>
        <Kb.Text negative={true} type="BodySmallSemiboldPrimaryLink" className="underline" onClick={onReadMore}>
          Read more
        </Kb.Text>
      </Kb.Box2>
      <Kb.Box2 direction="vertical" style={styles.closeIconContainer}>
        <Kb.Icon
          type="iconfont-close"
          color={theme.black_20}
          style={{padding: Kb.Styles.globalMargins.xtiny}}
          onClick={onHideChatBanner}
        />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(theme => ({
  closeIconContainer: Kb.Styles.platformStyles({
    common: {
      position: 'absolute',
    },
    isElectron: {
      right: Kb.Styles.globalMargins.tiny,
      top: Kb.Styles.globalMargins.tiny,
    },
    isMobile: {
      ...Kb.Styles.size(26),
      right: Kb.Styles.globalMargins.small,
      top: Kb.Styles.globalMargins.small,
    },
  }),
  containerBanner: Kb.Styles.platformStyles({
    common: {
      backgroundColor: theme.blue,
      flexShrink: 0,
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
    ...Kb.Styles.marginV(15),
  },
  illustration: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.paddingH(Kb.Styles.globalMargins.large),
    },
  }),
  text: Kb.Styles.platformStyles({
    common: {
      marginBottom: Kb.Styles.globalMargins.small,
    },
  }),
}))

export default Banner
