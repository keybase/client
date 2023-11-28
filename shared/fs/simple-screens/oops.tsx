import * as T from '@/constants/types'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as Container from '@/util/container'

type OwnProps = {
  path: T.FS.Path
  reason: T.FS.SoftError
}

type Props = OwnProps & {
  openParent: () => void
}

const Explain = (props: Props) => {
  const elems = T.FS.getPathElements(props.path)
  if (elems.length < 3) {
    return null
  }
  switch (elems[1]) {
    case 'public':
      return null
    case 'private':
      return (
        <Kb.Box2 direction="horizontal" style={styles.explainBox}>
          <Kb.Text center={true} type="Body">
            Only people in the private folder can access this.
          </Kb.Text>
        </Kb.Box2>
      )
    case 'team':
      return (
        <Kb.Box2 direction="horizontal" style={styles.explainBox}>
          <Kb.Text center={true} type="Body">
            Only members of
          </Kb.Text>
          <Kb.Text type="BodySemibold" style={styles.explainTextTeam}>
            {elems[2]}
          </Kb.Text>
          <Kb.Text center={true} type="Body">
            can access this.
          </Kb.Text>
        </Kb.Box2>
      )
    default:
      return null
  }
}

const NoAccess = (props: Props) => (
  <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true} fullHeight={true}>
    <Kb.Box2 direction="vertical" style={styles.main} fullWidth={true} centerChildren={true}>
      <Kb.Icon
        type={C.isMobile ? 'icon-fancy-no-access-mobile-128-125' : 'icon-fancy-no-access-desktop-96-94'}
      />
      <Kb.Text type="Header" style={styles.textYouDontHave}>
        You don't have access to this folder or file.
      </Kb.Text>
      <Explain {...props} />
      <Kb.Button
        type="Default"
        mode="Secondary"
        label="Go to parent folder"
        onClick={props.openParent}
        style={styles.button}
      />
    </Kb.Box2>
  </Kb.Box2>
)

const NonExistent = (props: Props) => (
  <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true} fullHeight={true}>
    <Kb.Box2 direction="vertical" style={styles.main} fullWidth={true} centerChildren={true}>
      <Kb.Icon
        type={
          C.isMobile
            ? 'icon-fancy-folder-file-inexistant-mobile-188-120'
            : 'icon-fancy-folder-file-inexistant-desktop-153-94'
        }
      />
      <Kb.Text type="Header" style={styles.textYouDontHave}>
        This file or folder doesn't exist.
      </Kb.Text>
      <Kb.Box2 direction="horizontal" style={styles.explainBox}>
        <Kb.Text center={true} type="Body">
          Either it was deleted, or the path is incorrect.
        </Kb.Text>
      </Kb.Box2>
      <Kb.Button
        type="Default"
        mode="Secondary"
        label="Go to parent folder"
        onClick={props.openParent}
        style={styles.button}
      />
    </Kb.Box2>
  </Kb.Box2>
)

const Oops = (props: OwnProps) => {
  const nav = Container.useSafeNavigation()
  const openParent = () =>
    nav.safeNavigateAppend({props: {path: T.FS.getPathParent(props.path)}, selected: 'fsRoot'})
  switch (props.reason) {
    case T.FS.SoftError.NoAccess:
      return <NoAccess {...props} openParent={openParent} />
    case T.FS.SoftError.Nonexistent:
      return <NonExistent {...props} openParent={openParent} />
    default:
      return null
  }
}

export default Oops

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      button: {marginTop: Kb.Styles.globalMargins.small},
      container: Kb.Styles.platformStyles({
        common: {backgroundColor: Kb.Styles.globalColors.white},
        isMobile: {padding: Kb.Styles.globalMargins.large},
      }),
      explainBox: Kb.Styles.platformStyles({
        isElectron: {marginTop: Kb.Styles.globalMargins.small},
        isMobile: {marginTop: Kb.Styles.globalMargins.medium},
      }),
      explainTextTeam: {
        marginLeft: Kb.Styles.globalMargins.xtiny,
        marginRight: Kb.Styles.globalMargins.xtiny,
      },
      footer: {paddingBottom: Kb.Styles.globalMargins.large},
      header: {
        backgroundColor: Kb.Styles.globalColors.red,
        height: 40,
      },
      main: {...Kb.Styles.globalStyles.flexGrow},
      textYouDontHave: Kb.Styles.platformStyles({
        isElectron: {marginTop: Kb.Styles.globalMargins.medium},
        isMobile: {
          marginTop: Kb.Styles.globalMargins.xlarge,
          textAlign: 'center',
        },
      }),
    }) as const
)
