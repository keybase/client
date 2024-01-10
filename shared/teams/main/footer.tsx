import * as C from '@/constants'
import * as Kb from '@/common-adapters'

const TeamsFooter = (props: {empty: boolean}) => {
  const isLoadingTeams = C.Waiting.useAnyWaiting(C.Teams.teamsLoadedWaitingKey)
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true} style={styles.container}>
      {isLoadingTeams ? (
        <Kb.ProgressIndicator type="Large" />
      ) : (
        <>
          {props.empty && (
            <Kb.Box2 direction="vertical" alignItems="center" gap="tiny" style={styles.empty}>
              <Kb.Box style={Kb.Styles.globalStyles.flexOne} />
              <Kb.Box>
                <Kb.Icon type="icon-dark-empty-lone-wolf-116-96" />
              </Kb.Box>
              <Kb.Text type="BodySmall">You are not a part of any team, lone wolf.</Kb.Text>
              <Kb.Box style={Kb.Styles.globalStyles.flexOne} />
            </Kb.Box2>
          )}
          <Kb.Box style={Kb.Styles.globalStyles.flexOne} />
          {(Kb.Styles.isMobile || !props.empty) && (
            <Kb.Text type="BodySmall" center={true}>
              Keybase team chats are encrypted – unlike Slack – and work for any size group, from casual
              friends to large communities.
            </Kb.Text>
          )}
        </>
      )}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: Kb.Styles.platformStyles({
    isElectron: Kb.Styles.padding(Kb.Styles.globalMargins.large),
    isMobile: {
      ...Kb.Styles.padding(
        Kb.Styles.globalMargins.medium,
        Kb.Styles.globalMargins.small,
        Kb.Styles.globalMargins.small
      ),
      flex: 1,
    },
  }),
  empty: Kb.Styles.platformStyles({
    isElectron: {paddingTop: 80},
    isMobile: {flex: 1, paddingBottom: Kb.Styles.globalMargins.small},
  }),
}))

export default TeamsFooter
