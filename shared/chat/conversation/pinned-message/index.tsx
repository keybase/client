import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {
  author: string
  onClick: () => void
  onDismiss: () => void
  text: string
}

const PinnedMessage = (props: Props) => {
  return props.text ? (
    <Kb.ClickableBox onClick={props.onClick} style={styles.container}>
      <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
        <Kb.Box2 direction="horizontal" style={styles.blueBar} />
        <Kb.Box2 direction="vertical" fullWidth={true} style={{flex: 1}}>
          <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
            <Kb.Text type="BodyTinySemibold" style={styles.author}>
              {props.author}
            </Kb.Text>
            <Kb.Text type="BodyTinySemibold" style={styles.label}>
              Pinned Message
            </Kb.Text>
          </Kb.Box2>
          <Kb.Markdown smallStandaloneEmoji={true} lineClamp={1} style={styles.text} serviceOnly={true}>
            {props.text}
          </Kb.Markdown>
        </Kb.Box2>
        <Kb.Icon
          onClick={props.onDismiss}
          type="iconfont-remove"
          style={Kb.iconCastPlatformStyles(styles.close)}
          boxStyle={styles.close}
        />
      </Kb.Box2>
    </Kb.ClickableBox>
  ) : null
}

const styles = Styles.styleSheetCreate({
  author: {
    color: Styles.globalColors.black,
  },
  blueBar: {
    alignSelf: 'stretch',
    backgroundColor: Styles.globalColors.blue,
    width: Styles.globalMargins.xtiny,
  },
  close: {
    alignSelf: 'center',
  },
  container: {
    ...Styles.padding(Styles.globalMargins.xtiny, Styles.globalMargins.tiny),
    backgroundColor: Styles.globalColors.white,
    borderBottomWidth: 1,
    borderColor: Styles.globalColors.black_10,
    borderStyle: 'solid',
    left: 0,
    position: 'absolute',
    top: 0,
    width: '100%',
  },
  label: {
    color: Styles.globalColors.blueDark,
  },
  text: Styles.platformStyles({
    common: {
      color: Styles.globalColors.black_50,
    },
    isElectron: {
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    },
  }),
})

export default PinnedMessage
