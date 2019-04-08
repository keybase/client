// @flow

import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

export type Props = {|
  onCancel: () => void,
  text: string,
  username: string,
|}

const ReplyPreview = (props: Props) => {
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.container} gap="tiny">
      <Kb.Icon onClick={props.onCancel} type="iconfont-close" />
      <Kb.Box2 direction="vertical" gap="tiny">
        <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true}>
          <Kb.Avatar username={props.username} size={24} />
          <Kb.Text type="Body">{props.username}</Kb.Text>
        </Kb.Box2>
        <Kb.Text type="BodySmall" style={styles.text}>
          {props.text}
        </Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
      border: `1px solid ${Styles.globalColors.black_20}`,
      borderRadius: Styles.borderRadius,
      marginBottom: Styles.globalMargins.xtiny,
      marginLeft: Styles.globalMargins.small,
      marginRight: Styles.globalMargins.small,
      padding: Styles.globalMargins.tiny,
    },
  }),
  text: Styles.platformStyles({
    isElectron: {
      display: 'inline',
      flex: 1,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  }),
})

export default ReplyPreview
