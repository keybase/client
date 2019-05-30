import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import {isMobile} from '../../constants/platform'

export type Props = {
  error?: boolean | null
  filename: string
  completePortion: number
  progressText: string
  isDone: boolean
  isFirst: boolean
  open?: () => void
  dismiss: () => void
  cancel: () => void
}

const Progress = props => (
  <Kb.Box2 style={styles.progress} direction="horizontal" fullWidth={true} centerChildren={true} gap="xtiny">
    <Kb.Box style={styles.tubeBox}>
      <Kb.Box style={styles.tube} />
      <Kb.Box
        style={Styles.collapseStyles([
          styles.tube,
          styles.tubeStuffing,
          {width: `${Math.round(100 * props.completePortion).toString()}%`},
        ])}
      />
    </Kb.Box>
    <Kb.Text type="BodyTinySemibold" negative={true}>
      {props.progressText}
    </Kb.Text>
  </Kb.Box2>
)

const Download = (props: Props) => (
  <Kb.Box2
    direction="horizontal"
    centerChildren={true}
    style={Styles.collapseStyles([styles.download, props.error && styles.red])}
    gap="tiny"
    gapStart={true}
    gapEnd={true}
  >
    <Kb.Box2 direction="vertical" centerChildren={true} fullHeight={true}>
      <Kb.Icon
        type={props.isDone ? 'iconfont-success' : 'iconfont-download'}
        color={Styles.globalColors.black_20}
      />
    </Kb.Box2>
    <Kb.Box2 direction="vertical" style={styles.nameAndProgress}>
      <Kb.Text
        type="BodySmallSemibold"
        onClick={isMobile ? undefined : props.open}
        style={styles.filename}
        lineClamp={isMobile ? 1 : undefined}
      >
        {props.filename}
      </Kb.Text>
      {!props.isDone && <Progress {...props} />}
    </Kb.Box2>
    <Kb.Box2 direction="vertical" centerChildren={true} fullHeight={true}>
      <Kb.Icon
        type="iconfont-remove"
        color={Styles.globalColors.white}
        onClick={props.isDone ? props.dismiss : props.cancel}
      />
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  download: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.green,
      borderRadius: 4,
    },
    isElectron: {
      height: 32,
      width: 140,
    },
    isMobile: {
      height: 40,
      width: 160,
    },
  }),
  filename: Styles.platformStyles({
    common: {
      color: Styles.globalColors.white,
    },
    isElectron: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  }),
  nameAndProgress: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  progress: {
    marginTop: -2,
  },
  red: {
    backgroundColor: Styles.globalColors.red,
  },
  tube: {
    backgroundColor: Styles.globalColors.black_20,
    borderRadius: 4.5,
    height: 4,
    width: '100%',
  },
  tubeBox: {
    flex: 1,
    position: 'relative',
  },
  tubeStuffing: {
    backgroundColor: Styles.globalColors.white,
    left: 0,
    position: 'absolute',
    top: 0,
  },
})

export default Download
