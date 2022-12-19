import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {
  onBack: () => void
  onDeleteTeam: () => void
  name: string
  stillLoadingTeam: boolean
}

const ReallyLeaveTeam = (props: Props) => (
  <Kb.Modal
    mode="Wide"
    onClose={props.onBack}
    header={{hideBorder: true}}
    footer={{
      content: (
        <Kb.ButtonBar direction="row" fullWidth={true} style={styles.buttonBar}>
          <Kb.Button
            onClick={props.onBack}
            label="Got it"
            fullWidth={true}
            type="Dim"
            disabled={props.stillLoadingTeam}
          />
        </Kb.ButtonBar>
      ),
      hideBorder: true,
      style: styles.footer,
    }}
  >
    {props.stillLoadingTeam ? (
      <Kb.ProgressIndicator type="Huge" />
    ) : (
      <Kb.Box2
        direction="vertical"
        alignItems="center"
        fullHeight={true}
        style={styles.container}
        centerChildren={true}
      >
        <Kb.Box2 direction="vertical" gap="medium" fullWidth={true} style={Styles.globalStyles.flexBoxCenter}>
          <Kb.Box2 direction="vertical" style={Styles.globalStyles.positionRelative}>
            <Kb.Avatar teamname={props.name} size={Styles.isMobile ? 96 : 64} />
            <Kb.Icon type="iconfont-leave" style={styles.leaveIcon} />
          </Kb.Box2>
          <Kb.Text type="Header" center={true} style={styles.headerText}>
            You can't leave the {props.name} team because you're the only owner.
          </Kb.Text>
          <Kb.Text type="Body" center={true} style={styles.bodyText}>
            You'll have to add another user as an owner before you can leave {props.name}. Or, you can{' '}
            <Kb.Text type="BodyPrimaryLink" onClick={props.onDeleteTeam}>
              delete the&nbsp;team
            </Kb.Text>
            .
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    )}
  </Kb.Modal>
)

const styles = Styles.styleSheetCreate(() => ({
  bodyText: Styles.platformStyles({isElectron: {maxWidth: 430}}),
  buttonBar: {
    minHeight: undefined,
  },
  container: Styles.platformStyles({
    isElectron: {
      height: '100%',
      marginBottom: 48, // footer height
      width: '100%',
    },
    isMobile: {
      ...Styles.padding(0, Styles.globalMargins.small),
      paddingBottom: 64, // footer height
    },
  }),
  footer: {
    borderStyle: 'solid',
    borderTopColor: Styles.globalColors.black_10,
    borderTopWidth: 1,
    padding: 0,
  },
  headerText: {maxWidth: 380},
  leaveIcon: Styles.platformStyles({
    common: {
      alignItems: 'center',
      backgroundColor: Styles.globalColors.red,
      borderColor: Styles.globalColors.white,
      borderStyle: 'solid',
      bottom: -10,
      color: Styles.globalColors.white,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      position: 'absolute',
      right: -10,
      textAlign: 'center',
    },
    isElectron: {
      borderRadius: 12,
      borderWidth: 2,
      height: 26,
      lineHeight: 26,
      width: 26,
    },
    isMobile: {
      borderRadius: 16,
      borderWidth: 3.5,
      height: 34,
      lineHeight: 34,
      width: 34,
    },
  }),
}))

export default ReallyLeaveTeam
