// @flow
import React from 'react'
import * as Kb from '../../../../common-adapters'
import {globalStyles, globalMargins, isMobile, styleSheetCreate} from '../../../../styles'

export type Props = {
  name: string,
  currency: string,
  keys: string,
  onDelete: () => void,
  onClose: () => void,
}

const RemoveAccountDialog = (props: Props) => (
  <Kb.MaybePopup onClose={props.onClose}>
    <Kb.Box style={styles.box}>
      <Kb.Icon
        type={isMobile ? 'icon-wallet-receive-64' : 'icon-wallet-receive-48'}
        style={Kb.iconCastPlatformStyles(styles.icon)}
      />
      <Kb.Text style={styles.warning} type="Header">
        Are you sure you want to remove{' '}
        <Kb.Text type="Header" style={styles.italic}>
          {props.name}
        </Kb.Text>{' '}
        from Keybase?
      </Kb.Text>
      <Kb.Text type="BodySmall">Balance:</Kb.Text>
      <Kb.Text type="BodySmallSemibold">{props.currency}</Kb.Text>
      <Kb.Text type="BodySmallSemibold">{props.keys}</Kb.Text>
      <Kb.ButtonBar style={styles.buttonbar}>
        <Kb.Button label="Cancel" onClick={props.onClose} type="Secondary" />
        <Kb.Button label="Yes, remove" onClick={props.onDelete} type="Danger" />
      </Kb.ButtonBar>
    </Kb.Box>
  </Kb.MaybePopup>
)

const styles = styleSheetCreate({
  icon: {
    marginBottom: globalMargins.small,
  },
  italic: {
    fontStyle: 'italic',
  },
  box: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    padding: globalMargins.large,
  },
  warning: {
    paddingBottom: globalMargins.medium,
    paddingTop: globalMargins.xtiny,
    textAlign: 'center',
  },
  buttonbar: {
    paddingTop: globalMargins.large,
  },
})

export default RemoveAccountDialog
