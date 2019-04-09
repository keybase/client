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
    <Kb.Box style={styles.outerContainer}>
      <Kb.Box2 direction="horizontal" style={styles.container} gap="small" fullWidth={true}>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
          <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true}>
            <Kb.Avatar username={props.username} size={24} />
            <Kb.Text type="Body">{props.username}</Kb.Text>
          </Kb.Box2>
          <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true}>
            <Kb.Text type="BodySmall" style={styles.text}>
              {props.text}
            </Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
        <Kb.Icon onClick={props.onCancel} type="iconfont-remove" boxStyle={styles.close} />
      </Kb.Box2>
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate({
  close: {
    alignSelf: 'center',
  },
  container: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
      border: `1px solid ${Styles.globalColors.black_20}`,
      borderRadius: Styles.borderRadius,
      padding: Styles.globalMargins.tiny,
    },
  }),
  outerContainer: {
    marginBottom: Styles.globalMargins.xtiny,
    marginLeft: Styles.globalMargins.small,
    marginRight: Styles.globalMargins.small,
    position: 'relative',
  },
  text: Styles.platformStyles({
    isElectron: {
      contain: 'strict',
      display: 'inline',
      flex: 1,
      height: 20,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  }),
})

export default ReplyPreview
