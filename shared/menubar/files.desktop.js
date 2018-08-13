// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
// TODO: uncomment once we make this.
// import * as RemoteContainer from '../fs/row/remote-container'

type TlfRow = {|
  // TODO: uncomment once we make this.
  // ...$Exact<RemoteContainer.RemoteTlfMeta>,
|}

type FilesPreviewProps = {
  onViewAll: () => void,
  tlfRows: Array<TlfRow>,
}

export const FilesPreview = ({onViewAll, onSelectConversation, tlfRows}: FilesPreviewProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.tlfContainer}>
    {tlfRows.map((r, i) => {
      return (
        <Kb.Text key={i} type="Body">
          Hello
        </Kb.Text>
      )
    })}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  buttonText: {color: Styles.globalColors.black_60},
  tlfContainer: {
    backgroundColor: Styles.globalColors.white,
    color: Styles.globalColors.black,
  },
  toggleButton: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.black_05,
      borderRadius: 19,
      marginBottom: Styles.globalMargins.xtiny,
      marginTop: Styles.globalMargins.xtiny,
      paddingBottom: Styles.globalMargins.xtiny,
      paddingTop: Styles.globalMargins.xtiny,
    },
    isElectron: {
      marginLeft: Styles.globalMargins.tiny,
      marginRight: Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
    },
  }),
})
