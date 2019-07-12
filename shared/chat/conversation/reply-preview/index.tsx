import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Constants from '../../../constants/chat2'
import * as Styles from '../../../styles'

export type Props = {
  imageHeight?: number
  imageURL?: string
  imageWidth?: number
  onCancel: () => void
  text: string
  username: string
}

const ReplyPreview = (props: Props) => {
  const sizing =
    props.imageWidth && props.imageHeight
      ? Constants.zoomImage(props.imageWidth, props.imageHeight, 80)
      : null
  return (
    <Kb.Box style={styles.outerContainer}>
      <Kb.Box2 direction="vertical" style={styles.container} gap="xtiny" fullWidth={true}>
        <Kb.Box2 direction="horizontal" style={styles.title} fullWidth={true}>
          <Kb.Text type="BodyTiny">Replying to...</Kb.Text>
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.replyContainer}>
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.contentContainer} gap="tiny">
            <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true}>
              <Kb.Avatar username={props.username} size={32} />
              <Kb.Text type="BodySemibold" style={styles.username}>
                {props.username}
              </Kb.Text>
            </Kb.Box2>
            <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
              {!!props.imageURL && (
                <Kb.Box2 direction="vertical" style={styles.replyImageContainer}>
                  <Kb.Box style={{...(sizing ? sizing.margins : {})}}>
                    <Kb.Image src={props.imageURL} style={{...(sizing ? sizing.dims : {})}} />
                  </Kb.Box>
                </Kb.Box2>
              )}
              <Kb.Text type="BodySmall" style={styles.text} lineClamp={1}>
                {props.text}
              </Kb.Text>
            </Kb.Box2>
          </Kb.Box2>
          <Kb.Icon
            onClick={props.onCancel}
            type="iconfont-remove"
            style={Kb.iconCastPlatformStyles(styles.close)}
            boxStyle={styles.close}
          />
        </Kb.Box2>
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
    },
  }),
  contentContainer: Styles.platformStyles({
    isMobile: {
      flex: 1,
    },
  }),
  outerContainer: Styles.platformStyles({
    isElectron: {
      marginBottom: Styles.globalMargins.xtiny,
      marginLeft: Styles.globalMargins.small,
      marginRight: Styles.globalMargins.small,
      position: 'relative',
    },
  }),
  replyContainer: {
    justifyContent: 'space-between',
    padding: Styles.globalMargins.tiny,
  },
  replyImageContainer: {
    overflow: 'hidden',
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
    isMobile: {
      flex: 1,
    },
  }),
  title: {
    backgroundColor: Styles.globalColors.black_05,
    borderBottomWidth: 1,
    borderColor: Styles.globalColors.black_10,
    borderStyle: 'solid',
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: Styles.globalMargins.xsmall,
    paddingTop: Styles.globalMargins.tiny,
  },
  username: {
    alignSelf: 'center',
  },
})

export default ReplyPreview
