import * as React from 'react'
import * as Styles from '../../styles'
import {Box, Button, Icon, Text} from '../../common-adapters'

import type {Props} from './index'

class InviteGeneratedRender extends React.Component<Props> {
  render() {
    return (
      <Box
        style={{
          ...Styles.globalStyles.flexBoxColumn,
          alignItems: 'center',
          flex: 1,
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <Icon type="iconfont-close" style={styles.icon} onClick={this.props.onClose} />
        <Icon type="icon-invite-link-48" />
        {this.props.email ? (
          <Text center={true} type="Body" style={styles.text}>
            Yay! We emailed <Text type="BodySemibold">{this.props.email}</Text>, but you can also give them
            the below link:
          </Text>
        ) : (
          <Text center={true} type="Body" style={styles.text}>
            Yay! Please share the below link with your friend. It contains signup &amp; install instructions.
          </Text>
        )}
        <Box style={styles.linkContainer}>
          <Icon
            type="iconfont-link"
            style={{height: 14, marginRight: Styles.globalMargins.tiny}}
            color={Styles.globalColors.black_10}
          />
          <Text type="BodySemibold" selectable={true} style={{color: Styles.globalColors.greenDark}}>
            {this.props.link}
          </Text>
        </Box>
        <Button style={{marginTop: Styles.globalMargins.medium}} label="Close" onClick={this.props.onClose} />
      </Box>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  icon: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.clickable,
      position: 'absolute',
      right: Styles.globalMargins.small,
      top: Styles.globalMargins.small,
    },
  }),
  linkContainer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    backgroundColor: Styles.globalColors.greenLighter,
    borderRadius: Styles.borderRadius,
    height: 32,
    marginTop: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: Styles.globalMargins.xsmall,
  },

  text: {
    paddingTop: Styles.globalMargins.medium,
    width: 440,
  },
}))
export default InviteGeneratedRender
