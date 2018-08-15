// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import {Text, Box, Box2, WithTooltip, Icon, iconCastPlatformStyles} from '../../common-adapters'
import {isMobile} from '../../constants/platform'

type ErrProps = {
  time: number,
  error: string,
  msg: string,
  retry?: () => void,
  dismiss: () => void,
}

const Err = (props: ErrProps) => (
  <Box2 fullWidth={true} direction="horizontal" style={styles.container} gap="tiny">
    {!isMobile && (
      <WithTooltip text={props.error} multiline={true} position="top center">
        <Icon
          type="iconfont-exclamation"
          style={iconCastPlatformStyles(styles.icon)}
          color={Styles.globalColors.white_90}
          hoverColor={Styles.globalColors.white}
        />
      </WithTooltip>
    )}
    <Text type="BodySmall" style={styles.text}>
      {props.msg}
    </Text>
    <Box style={Styles.globalStyles.flexGrow} />
    {!!props.retry && (
      <Text type="BodySmallSemibold" onClick={props.retry} style={styles.text} underline={true}>
        Retry
      </Text>
    )}
    <Icon
      type="iconfont-close"
      style={iconCastPlatformStyles(styles.icon)}
      color={Styles.globalColors.white_90}
      hoverColor={Styles.globalColors.white}
      onClick={props.dismiss}
    />
    {/* TODO: display timestamp? Would need to refresh on second though. */}
  </Box2>
)

type ErrsProps = {
  errs: Array<ErrProps & {key: string}>,
  more?: number,
}

const Errs = (props: ErrsProps) => (
  <Box2 fullWidth={true} direction="vertical">
    {props.errs.map(errProp => <Err key={errProp.key} {...errProp} />)}
    {!!props.more && (
      <Box2 fullWidth={true} direction="horizontal" style={styles.moreContainer}>
        <Text type="BodySmall">
          {props.more.toString()} more {props.more && props.more > 1 ? 'errors' : 'error'} ...
        </Text>
      </Box2>
    )}
  </Box2>
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
