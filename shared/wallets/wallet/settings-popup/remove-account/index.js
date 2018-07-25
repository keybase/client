// @flow
import React from 'react'
import {
  Box,
  Button,
  MaybePopup,
  Text,
  ButtonBar,
  Icon,
  iconCastPlatformStyles,
} from '../../../../common-adapters'
import {globalStyles, globalMargins, isMobile, styleSheetCreate} from '../../../../styles'

export type Props = {
  name: string,
  currency: string,
  keys: string,
  onDelete: () => void,
  onClose: () => void,
}

const RemoveAccountDialog = (props: Props) => (
  <MaybePopup onClose={props.onClose}>
    <Box style={styles.box}>
      <Icon
        type={isMobile ? 'icon-wallet-receive-64' : 'icon-wallet-receive-48'}
        style={iconCastPlatformStyles(styles.icon)}
      />
      <Text style={styles.warning} type="Header">
        Are you sure you want to remove{' '}
        <Text type="Header" style={{fontStyle: 'italic'}}>
          {props.name}
        </Text>{' '}
        from Keybase?
      </Text>
      <Text type="BodySmall">Balance:</Text>
      <Text type="BodySmallBold">{props.currency}</Text>
      <Text type="BodySmallBold">{props.keys}</Text>
      <ButtonBar style={styles.buttonbar}>
        <Button label="Cancel" onClick={props.onClose} type="Secondary" />
        <Button label="Yes, remove" onClick={props.onDelete} type="Danger" />
      </ButtonBar>
    </Box>
  </MaybePopup>
)

const styles = styleSheetCreate({
  icon: {
    marginBottom: globalMargins.small,
  },
  box: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    padding: globalMargins.large,
  },
  warning: {
    paddingBottom: globalMargins.medium,
    paddingTop: globalMargins.xtiny,
  },
  buttonbar: {
    paddingTop: globalMargins.large,
  },
})

export default RemoveAccountDialog
