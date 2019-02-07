// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import PathItemActionWithClickableComponent from './path-item-action-with-clickable-component-container'

type Props = {|
  actionIconClassName?: string,
  actionIconFontSize?: number,
  actionIconWhite?: boolean,
  path: Types.Path,
  routePath: I.List<string>,
|}

export default (props: Props) => (
  <PathItemActionWithClickableComponent
    clickable={({onClick, setRef}) => (
      <Kb.ClickableBox onClick={onClick} ref={setRef}>
        <Kb.Icon
          type="iconfont-ellipsis"
          color={props.actionIconWhite ? Styles.globalColors.white : Styles.globalColors.black_50}
          style={Kb.iconCastPlatformStyles(styles.actionIcon)}
          fontSize={props.actionIconFontSize}
          className={props.actionIconClassName}
        />
      </Kb.ClickableBox>
    )}
    path={props.path}
    routePath={props.routePath}
    initView="root"
  />
)

const styles = Styles.styleSheetCreate({
  actionIcon: {
    padding: Styles.globalMargins.tiny,
  },
})
