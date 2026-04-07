import * as Kb from '@/common-adapters'

type Props = {
  onBack: () => void
  onDeleteTeam: () => void
  name: string
  stillLoadingTeam: boolean
}

const ReallyLeaveTeam = (props: Props) => (
  <>
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
        <Kb.Box2
          direction="vertical"
          gap="medium"
          fullWidth={true}
          style={Kb.Styles.globalStyles.flexBoxCenter}
        >
          <Kb.Box2 direction="vertical" style={Kb.Styles.globalStyles.positionRelative}>
            <Kb.Avatar teamname={props.name} size={Kb.Styles.isMobile ? 96 : 64} />
            <Kb.Icon type="iconfont-leave" style={styles.leaveIcon} />
          </Kb.Box2>
          <Kb.Text type="Header" center={true} style={styles.headerText}>
            {"You can't leave the {props.name} team because you're the only owner."}
          </Kb.Text>
          <Kb.Text type="Body" center={true} style={styles.bodyText}>
            {`You'll have to add another user as an owner before you can leave ${props.name}. Or, you can `}
            <Kb.Text type="BodyPrimaryLink" onClick={props.onDeleteTeam}>
              delete the&nbsp;team
            </Kb.Text>
            .
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    )}
    <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={Kb.Styles.collapseStyles([styles.modalFooter, styles.footer])}>
      <Kb.ButtonBar direction="row" fullWidth={true} style={styles.buttonBar}>
        <Kb.Button
          onClick={props.onBack}
          label="Got it"
          fullWidth={true}
          type="Dim"
          disabled={props.stillLoadingTeam}
        />
      </Kb.ButtonBar>
    </Kb.Box2>
  </>
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  bodyText: Kb.Styles.platformStyles({isElectron: {maxWidth: 430}}),
  buttonBar: {
    minHeight: undefined,
  },
  container: Kb.Styles.platformStyles({
    isElectron: {
      height: '100%',
      marginBottom: 48, // footer height
      width: '100%',
    },
    isMobile: {
      ...Kb.Styles.padding(0, Kb.Styles.globalMargins.small),
      paddingBottom: 64, // footer height
    },
  }),
  footer: {
    borderStyle: 'solid',
    borderTopColor: Kb.Styles.globalColors.black_10,
    borderTopWidth: 1,
    padding: 0,
  },
  headerText: {maxWidth: 380},
  leaveIcon: Kb.Styles.platformStyles({
    common: {
      alignItems: 'center',
      backgroundColor: Kb.Styles.globalColors.red,
      borderColor: Kb.Styles.globalColors.white,
      borderStyle: 'solid',
      bottom: -10,
      color: Kb.Styles.globalColors.white,
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
  modalFooter: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
      borderStyle: 'solid' as const,
      borderTopColor: Kb.Styles.globalColors.black_10,
      borderTopWidth: 1,
      minHeight: 56,
    },
    isElectron: {
      borderBottomLeftRadius: Kb.Styles.borderRadius,
      borderBottomRightRadius: Kb.Styles.borderRadius,
      overflow: 'hidden',
    },
  }),
}))

export default ReallyLeaveTeam
