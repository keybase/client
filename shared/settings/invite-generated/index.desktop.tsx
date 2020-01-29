import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import {Props} from '.'

class InviteGeneratedRender extends React.Component<Props> {
  render() {
    return (
      <Kb.Box
        style={{
          ...Styles.globalStyles.flexBoxColumn,
          alignItems: 'center',
          flex: 1,
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <Kb.Icon type={Kb.IconType.iconfont_close} style={styles.icon} onClick={this.props.onClose} />
        <Kb.Icon type={Kb.IconType.icon_invite_link_48} />
        {this.props.email ? (
          <Kb.Text center={true} type="Body" style={styles.text}>
            Yay! We emailed <Kb.Text type="BodySemibold">{this.props.email}</Kb.Text>, but you can also give
            them the below link:
          </Kb.Text>
        ) : (
          <Kb.Text center={true} type="Body" style={styles.text}>
            Yay! Please share the below link with your friend. It contains signup &amp; install instructions.
          </Kb.Text>
        )}
        <Kb.Box style={styles.linkContainer}>
          <Kb.Icon
            type={Kb.IconType.iconfont_link}
            style={{height: 14, marginRight: Styles.globalMargins.tiny}}
            color={Styles.globalColors.black_10}
          />
          <Kb.Text type="BodySemibold" selectable={true} style={{color: Styles.globalColors.greenDark}}>
            {this.props.link}
          </Kb.Text>
        </Kb.Box>
        <Kb.Button
          style={{marginTop: Styles.globalMargins.medium}}
          label="Close"
          onClick={this.props.onClose}
        />
      </Kb.Box>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  icon: Styles.collapseStyles([
    Styles.desktopStyles.clickable,
    {
      position: 'absolute',
      right: Styles.globalMargins.small,
      top: Styles.globalMargins.small,
    },
  ]),
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
