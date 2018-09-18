// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import {isMobile} from '../../constants/platform'

type ErrProps = {
  time: number,
  error: string,
  msg: string,
  retry?: () => void,
  dismiss: () => void,
}

const Err = (props: ErrProps) => (
  <Kb.Box2 fullWidth={true} direction="horizontal" style={styles.container} gap="tiny">
    {!isMobile && (
      <Kb.WithTooltip text={props.error} multiline={true} position="top center">
        <Kb.Icon
          type="iconfont-exclamation"
          style={Kb.iconCastPlatformStyles(styles.icon)}
          color={Styles.globalColors.white_90}
          hoverColor={Styles.globalColors.white}
        />
      </Kb.WithTooltip>
    )}
    <Kb.Box style={styles.textBox}>
      <Kb.Text type="BodySmall" style={styles.text}>
        {props.msg}
      </Kb.Text>
    </Kb.Box>
    <Kb.Box style={Styles.globalStyles.flexGrow} />
    {!!props.retry && (
      <Kb.Text type="BodySmallSemibold" onClick={props.retry} style={styles.text} underline={true}>
        Retry
      </Kb.Text>
    )}
    <Kb.Icon
      type="iconfont-close"
      style={Kb.iconCastPlatformStyles(styles.icon)}
      color={Styles.globalColors.white_90}
      hoverColor={Styles.globalColors.white}
      onClick={props.dismiss}
    />
    {/* TODO: display timestamp? Would need to refresh on second though. */}
  </Kb.Box2>
)

type ErrsProps = {
  errs: Array<ErrProps & {key: string}>,
  more?: number,
}

const Errs = (props: ErrsProps) => (
  <Kb.Box2 fullWidth={true} direction="vertical">
    {props.errs.map(err => (
      <Err
        key={err.key}
        time={err.time}
        error={err.error}
        msg={err.msg}
        retry={err.retry}
        dismiss={err.dismiss}
      />
    ))}
    {!!props.more && (
      <Kb.Box2 fullWidth={true} direction="horizontal" style={styles.moreContainer}>
        <Kb.Text type="BodySmall">
          {props.more.toString()} more {props.more && props.more > 1 ? 'errors' : 'error'} ...
        </Kb.Text>
      </Kb.Box2>
    )}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  container: {
    backgroundColor: Styles.globalColors.red,
    padding: Styles.globalMargins.xtiny,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderStyle: 'solid',
    borderBottomColor: Styles.globalColors.white_20,
  },
  textBox: {
    flexShrink: 1,
  },
  text: {
    color: Styles.globalColors.white,
  },
  icon: Styles.platformStyles({
    common: {
      padding: Styles.globalMargins.xtiny,
    },
    isElectron: {
      lineHeight: '26px',
    },
  }),
  rightContainer: {
    alignItems: 'center',
    marginLeft: 'auto', // pushes to right
  },
  moreContainer: {
    backgroundColor: Styles.globalColors.white,
    justifyContent: 'center',
  },
})

export default Errs
