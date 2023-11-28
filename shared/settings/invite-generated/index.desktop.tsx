import * as React from 'react'
import * as Kb from '@/common-adapters'
import type {Props} from '.'

const InviteGeneratedRender = (p: Props) => {
  return (
    <Kb.Box
      style={{
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <Kb.Icon type="iconfont-close" style={styles.icon} onClick={p.onClose} />
      <Kb.Icon type="icon-invite-link-48" />
      {p.email ? (
        <Kb.Text center={true} type="Body" style={styles.text}>
          Yay! We emailed <Kb.Text type="BodySemibold">{p.email}</Kb.Text>, but you can also give them the
          below link:
        </Kb.Text>
      ) : (
        <Kb.Text center={true} type="Body" style={styles.text}>
          Yay! Please share the below link with your friend. It contains signup &amp; install instructions.
        </Kb.Text>
      )}
      <Kb.Box style={styles.linkContainer}>
        <Kb.Icon
          type="iconfont-link"
          style={{height: 14, marginRight: Kb.Styles.globalMargins.tiny}}
          color={Kb.Styles.globalColors.black_10}
        />
        <Kb.Text type="BodySemibold" selectable={true} style={{color: Kb.Styles.globalColors.greenDark}}>
          {p.link}
        </Kb.Text>
      </Kb.Box>
      <Kb.Button style={{marginTop: Kb.Styles.globalMargins.medium}} label="Close" onClick={p.onClose} />
    </Kb.Box>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  icon: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.desktopStyles.clickable,
      position: 'absolute',
      right: Kb.Styles.globalMargins.small,
      top: Kb.Styles.globalMargins.small,
    },
  }),
  linkContainer: {
    ...Kb.Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    backgroundColor: Kb.Styles.globalColors.greenLighter,
    borderRadius: Kb.Styles.borderRadius,
    height: 32,
    marginTop: Kb.Styles.globalMargins.tiny,
    paddingLeft: Kb.Styles.globalMargins.xsmall,
    paddingRight: Kb.Styles.globalMargins.xsmall,
  },

  text: {
    paddingTop: Kb.Styles.globalMargins.medium,
    width: 440,
  },
}))
export default InviteGeneratedRender
