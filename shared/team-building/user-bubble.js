// @flow
import React from 'react'
import * as Kb from '../common-adapters/index'
import {isMobile} from '../constants/platform'
import * as Styles from '../styles'
import type {ServiceId} from '../util/platforms'

// TODO
// * Add service icons and colors
// * style

export type Props = {
  username: string,
  prettyName: string,
  service: ServiceId,
  onRemove: () => void,
}

const KeybaseUserBubble = (props: Props) => (
  <Kb.Box2 className="user" direction="horizontal" style={styles.bubble}>
    <Kb.Avatar size={BUBBLE_SIZE} username={props.username} />
  </Kb.Box2>
)

const GeneralServiceBubble = (props: Props) => (
  <Kb.Box2 className="user" direction="horizontal" style={styles.generalService} />
)

const RemoveBubble = ({onRemove, prettyName}: {onRemove: () => void, prettyName: string}) => (
  <Kb.WithTooltip text={prettyName} position={'top center'} containerStyle={styles.remove} className="remove">
    <Kb.ClickableBox onClick={() => onRemove()}>
      <Kb.Icon type={'iconfont-close'} style={styles.removeIcon} />
    </Kb.ClickableBox>
  </Kb.WithTooltip>
)

const UserBubble = (props: Props) => {
  const HoverComponent = Kb.HoverHoc(
    () =>
      props.service === 'keybase' ? <KeybaseUserBubble {...props} /> : <GeneralServiceBubble {...props} />,
    () => <RemoveBubble prettyName={props.prettyName} onRemove={props.onRemove} />
  )

  return <HoverComponent containerStyle={styles.container} />
}

// TODO update mobile bubble size
const BUBBLE_SIZE = isMobile ? 32 : 28

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      marginLeft: Styles.globalMargins.tiny,
    },
  }),

  bubble: Styles.platformStyles({
    common: {
      height: BUBBLE_SIZE,
      width: BUBBLE_SIZE,
    },
  }),

  remove: {
    backgroundColor: Styles.globalColors.red,
    borderRadius: 100,
    cursor: 'pointer',
    height: BUBBLE_SIZE,
    width: BUBBLE_SIZE,
  },

  removeIcon: {
    color: Styles.globalColors.white,
    fontSize: 18,
    left: 5,
    position: 'relative',
    top: 6,
  },

  generalService: {
    backgroundColor: 'grey',
    borderRadius: 100,
    height: BUBBLE_SIZE,
    width: BUBBLE_SIZE,
  },
})

export default UserBubble
