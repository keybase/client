// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as TeamTypes from '../../../../constants/types/teams'
import * as TeamConstants from '../../../../constants/teams'
import * as Style from '../../../../styles'
import {upperFirst} from 'lodash-es'

type Props = {
  canSetMinWriterRole: boolean,
  minWriterRole: TeamTypes.TeamRoleType,
  onSetNewRole: (newRole: TeamTypes.TeamRoleType) => void,
}

const _MinWriterRole = (props: Props & Kb.OverlayParentProps) => {
  const items = TeamConstants.teamRoleTypes.map(role => ({
    onClick: () => props.onSetNewRole(role),
    title: upperFirst(role),
  }))
  return (
    <Kb.Box2
      ref={props.setAttachmentRef}
      direction="vertical"
      gap="xtiny"
      fullWidth={true}
      style={styles.container}
    >
      <Kb.Box2 direction="horizontal" fullWidth={true} gap="xtiny">
        <Kb.Text type="BodySmallSemibold">Minimum writer role</Kb.Text>
        <Kb.Icon
          type="iconfont-compose"
          color={Style.globalColors.black_20}
          fontSize={Style.isMobile ? 22 : 16}
        />
      </Kb.Box2>
      <Kb.Text type="HeaderBig" onClick={props.toggleShowingMenu}>
        {upperFirst(props.minWriterRole)}
      </Kb.Text>
      <Kb.FloatingMenu
        attachTo={props.attachmentRef}
        closeOnSelect={true}
        visible={props.showingMenu}
        items={items}
        onHidden={props.toggleShowingMenu}
        position="top center"
        positionFallbacks={['bottom center']}
      />
    </Kb.Box2>
  )
}
const MinWriterRole = Kb.OverlayParentHOC(_MinWriterRole)

const styles = Style.styleSheetCreate({
  container: {
    paddingLeft: Style.globalMargins.small,
    paddingRight: Style.globalMargins.small,
  },
})

export default MinWriterRole
