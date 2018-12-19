// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {withProps} from 'recompose'
import {isMobile} from '../../constants/platform'

type Props = {
  path: Types.Path,
  onCancel: () => void,
}

const Explain = (props: Props) => {
  const elems = Types.getPathElements(props.path)
  if (elems.length < 3) {
    return null
  }
  switch (elems[1]) {
    case 'public':
      return null
    case 'private':
      return (
        <Kb.Box2 direction="horizontal" style={styles.explainBox}>
          <Kb.Text type="Body" style={styles.explainText}>
            Only people in the private folder can access this.
          </Kb.Text>
        </Kb.Box2>
      )
    case 'team':
      return (
        <Kb.Box2 direction="horizontal" style={styles.explainBox}>
          <Kb.Text type="Body" style={styles.explainText}>
            Only members of
          </Kb.Text>
          <Kb.Text type="BodySemibold" style={styles.explainTextTeam}>
            {elems[2]}
          </Kb.Text>
          <Kb.Text type="Body" style={styles.explainText}>
            can access this.
          </Kb.Text>
        </Kb.Box2>
      )
    default:
      return null
  }
}

const OopsNoAccess = (props: Props) => (
  <Kb.Box2 direction="vertical" style={styles.container}>
    {!isMobile && (
      <Kb.Box2 direction="horizontal" centerChildren={true} fullWidth={true} style={styles.header}>
        <Kb.Text type="BodySemibold" backgroundMode="HighRisk">
          Oops.
        </Kb.Text>
      </Kb.Box2>
    )}
    <Kb.Box2 direction="vertical" style={styles.main} fullWidth={true} centerChildren={true}>
      <Kb.Icon
        type={isMobile ? 'icon-fancy-no-access-mobile-128-125' : 'icon-fancy-no-access-desktop-96-94'}
      />
      <Kb.Text type="Header" style={styles.textYouDontHave}>
        You don't have access to this folder or file.
      </Kb.Text>
      <Explain {...props} />
    </Kb.Box2>
    {!isMobile && (
      <Kb.Box2 direction="horizontal" style={styles.footer} fullWidth={true} centerChildren={true}>
        <Kb.Button type="Primary" label="Got it" onClick={props.onCancel} />
      </Kb.Box2>
    )}
  </Kb.Box2>
)

export default (isMobile
  ? withProps<Props & {customCancelText: string}, Props>(({path, onCancel}) => ({
      customCancelText: 'Close',
      onCancel,
      path,
    }))(Kb.HeaderOrPopup(OopsNoAccess))
  : Kb.HeaderOrPopup(OopsNoAccess))

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      height: 380,
      width: 560,
    },
    isMobile: {
      padding: Styles.globalMargins.large,
    },
  }),
  explainBox: Styles.platformStyles({
    isElectron: {
      marginTop: Styles.globalMargins.small,
    },
    isMobile: {
      marginTop: Styles.globalMargins.medium,
    },
  }),
  explainText: {
    textAlign: 'center',
  },
  explainTextTeam: {
    marginLeft: Styles.globalMargins.xtiny,
    marginRight: Styles.globalMargins.xtiny,
  },
  footer: {
    paddingBottom: Styles.globalMargins.large,
  },
  header: {
    backgroundColor: Styles.globalColors.red,
    height: 40,
  },
  main: {
    ...Styles.globalStyles.flexGrow,
  },
  textYouDontHave: Styles.platformStyles({
    isElectron: {
      marginTop: Styles.globalMargins.medium,
    },
    isMobile: {
      marginTop: Styles.globalMargins.xlarge,
      textAlign: 'center',
    },
  }),
})
