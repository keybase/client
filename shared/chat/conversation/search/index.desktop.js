// @flow

import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import type {Props} from './index.types'

const ThreadSearch = (props: Props) => {
  return (
    <Kb.Box2 direction="horizontal" style={styles.outerContainer} fullWidth={true} gap="tiny">
      <Kb.Box2 direction="horizontal" style={styles.inputContainer} fullWidth={true}>
        <Kb.Box2 direction="horizontal" gap="xtiny">
          <Kb.Icon
            type="iconfont-search"
            color={Styles.globalColors.black_50}
            fontSize={14}
            boxStyle={styles.iconBox}
          />
          <Kb.Input hideUnderline={true} hintText={'Search...'} small={true} />
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" gap="tiny">
          {props.inProgress && <Kb.ProgressIndicator style={styles.progress} />}
          {props.totalResults > 0 && (
            <Kb.Text type="BodySmall">
              {props.selectedResult} of {props.totalResults}
            </Kb.Text>
          )}
          <Kb.Icon
            boxStyle={styles.iconBox}
            color={Styles.globalColors.black_50}
            fontSize={14}
            onClick={props.onUp}
            type="iconfont-arrow-up"
          />
          <Kb.Icon
            boxStyle={styles.iconBox}
            color={Styles.globalColors.black_50}
            fontSize={14}
            onClick={props.onDown}
            type="iconfont-arrow-down"
          />
        </Kb.Box2>
      </Kb.Box2>
      <Kb.Button type="Primary" onClick={props.onSearch} label="Search" />
      <Kb.Button type="Secondary" onClick={props.onCancel} label="Cancel" />
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  iconBox: {
    alignSelf: 'center',
  },
  inputContainer: {
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.black_20,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    justifyContent: 'space-between',
    paddingBottom: Styles.globalMargins.xtiny,
    paddingLeft: Styles.globalMargins.tiny,
    paddingRight: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.xtiny,
  },
  outerContainer: {
    backgroundColor: Styles.globalColors.blue5,
    padding: Styles.globalMargins.tiny,
  },
  progress: {
    height: 14,
  },
})

export default ThreadSearch
