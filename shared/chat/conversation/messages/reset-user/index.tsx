import * as Kb from '@/common-adapters'

type Props = {
  allowChatWithoutThem: boolean
  username: string
  viewProfile: () => void
  chatWithoutThem: () => void
  letThemIn: () => void
}

const ResetUser = ({username, viewProfile, letThemIn, allowChatWithoutThem, chatWithoutThem}: Props) => (
  <Kb.Box2 direction="vertical" style={styles.container}>
    <Kb.Icon type={Kb.Styles.isMobile ? 'icon-skull-64' : 'icon-skull-48'} style={styles.skullIcon} />
    <Kb.Box2 direction="vertical" style={styles.textContainer}>
      <Kb.Text center={true} type="BodySemibold" negative={true}>
        <Kb.Text type="BodySemiboldLink" negative={true} onClick={viewProfile}>
          {username}
        </Kb.Text>{' '}
        <Kb.Text type="BodySemibold" negative={true}>
          lost all their devices and this account has new keys. If you want to let them into this chat and
          folder's history, you should either:
        </Kb.Text>
      </Kb.Text>
      <Kb.Box style={styles.bullet}>
        <Kb.Text type="BodySemibold" negative={true} style={{marginTop: Kb.Styles.globalMargins.tiny}}>
          1. Be satisfied with their new proofs, or
        </Kb.Text>
        <Kb.Text type="BodySemibold" negative={true} style={{marginTop: Kb.Styles.globalMargins.tiny}}>
          2. Know them outside Keybase and have gotten a thumbs up from them.
        </Kb.Text>
      </Kb.Box>
      <Kb.Text type="BodySemibold" negative={true} style={styles.lastSentence}>
        Don't let them in until one of the above is&nbsp;true.
      </Kb.Text>
      <Kb.ButtonBar align="center" direction="column" fullWidth={true} style={styles.buttonContainer}>
        <Kb.Button
          backgroundColor="red"
          fullWidth={true}
          label="View profile"
          mode="Secondary"
          type="Dim"
          onClick={viewProfile}
        />
        <Kb.Button
          backgroundColor="red"
          fullWidth={true}
          label="Let them in"
          onClick={letThemIn}
          type="Dim"
        />
      </Kb.ButtonBar>
      {allowChatWithoutThem && (
        <Kb.Text type="BodySemibold" negative={true}>
          Or until you’re sure,{' '}
          <Kb.Text type="BodySemiboldLink" negative={true} onClick={chatWithoutThem}>
            chat without them
          </Kb.Text>
        </Kb.Text>
      )}
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      bullet: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        maxWidth: 320,
      },
      buttonContainer: {
        alignItems: 'center',
        marginBottom: Kb.Styles.globalMargins.small,
        marginTop: Kb.Styles.globalMargins.small,
        width: '100%',
      },
      container: {
        alignItems: 'center',
        backgroundColor: Kb.Styles.globalColors.red,
        marginBottom: -Kb.Styles.globalMargins.small,
        marginTop: Kb.Styles.globalMargins.small,
        padding: Kb.Styles.globalMargins.small,
        width: '100%',
      },
      lastSentence: {
        marginTop: Kb.Styles.globalMargins.medium,
        textAlign: 'center',
      },
      skullIcon: Kb.Styles.platformStyles({
        common: {margin: Kb.Styles.globalMargins.medium},
        isElectron: {height: 48, width: 48},
        isMobile: {height: 64, width: 64},
      }),
      textContainer: Kb.Styles.platformStyles({
        common: {
          alignItems: 'center',
          width: '100%',
        },
        isElectron: {
          paddingLeft: Kb.Styles.globalMargins.large,
          paddingRight: Kb.Styles.globalMargins.large,
        },
      }),
    }) as const
)

export default ResetUser
