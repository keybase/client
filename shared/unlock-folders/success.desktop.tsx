import * as React from 'react'
import * as Styles from '../styles'
import * as Kb from '../common-adapters'

const PaperKeyInput = ({onClose}: {onClose: () => void}) => (
  <div style={styles.container}>
    <Kb.Icon type="icon-folder-success-48" />
    <Kb.Box style={Styles.globalStyles.flexBoxColumn}>
      <Kb.Text center={true} type="BodySemibold">
        Success!
      </Kb.Text>
      <Kb.Text center={true} style={{paddingLeft: 40, paddingRight: 40}} type="Body">
        Your paper key is now rekeying folders for this computer. It takes just a couple minutes but lasts
        forever, like the decision to have a child
      </Kb.Text>
    </Kb.Box>
    <Kb.ButtonBar>
      <Kb.Button label="Okay" onClick={onClose} />
    </Kb.ButtonBar>
  </div>
)

const styles = Styles.styleSheetCreate({
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    bottom: 30,
    justifyContent: 'space-between',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 40,
  },
})

export default PaperKeyInput
