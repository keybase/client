import * as Kb from '@/common-adapters'

type Props = {
  onBack: () => void
  onDeleteTeam: () => void
  name: string
  stillLoadingTeam: boolean
}

const LastOwnerDialog = (props: Props) => {
  const {onBack, onDeleteTeam, name, stillLoadingTeam} = props
  const styles = useStyles()
  return (
    <Kb.ModalScreen
      centered={true}
      footer={<Kb.Button onClick={onBack} label="Got it" fullWidth={true} type="Dim" disabled={stillLoadingTeam} />}
    >
      {stillLoadingTeam ? (
        <Kb.ProgressIndicator type="Huge" />
      ) : (
        <Kb.Box2 direction="vertical" gap="medium" fullWidth={true} centerChildren={true} style={styles.container}>
          <Kb.Box2 direction="vertical" style={Kb.Styles.globalStyles.positionRelative}>
            <Kb.Avatar teamname={name} size={isMobile ? 96 : 64} />
            <Kb.Icon type="iconfont-leave" style={styles.leaveIcon} />
          </Kb.Box2>
          <Kb.Text type="BodyBig" center={true}>
            {`You can't leave the ${name} team because you're the only owner.`}
          </Kb.Text>
          <Kb.Text type="Body" center={true}>
            {`You'll have to add another user as an owner before you can leave ${name}. Or, you can `}
            <Kb.Text type="BodyPrimaryLink" onClick={onDeleteTeam}>
              delete the&nbsp;team
            </Kb.Text>
            .
          </Kb.Text>
        </Kb.Box2>
      )}
    </Kb.ModalScreen>
  )
}

const useStyles = Kb.Styles.createStyleHook(theme => ({
  container: {paddingTop: Kb.Styles.globalMargins.small},
  leaveIcon: Kb.Styles.platformStyles({
    common: {
      alignItems: 'center',
      backgroundColor: theme.red,
      borderColor: theme.white,
      borderStyle: 'solid',
      bottom: -10,
      color: theme.white,
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
      ...Kb.Styles.size(26),
      lineHeight: 26,
    },
    isMobile: {
      borderRadius: 16,
      borderWidth: 3.5,
      ...Kb.Styles.size(34),
      lineHeight: 34,
    },
  }),
}))

export default LastOwnerDialog
