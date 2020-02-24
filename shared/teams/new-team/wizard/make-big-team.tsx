import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Container from '../../../util/container'
import * as Styles from '../../../styles'
import {ModalTitle} from '../../common'

type Props = {
  teamname: string
}

const MakeBigTeam = (props: Props) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const onBack = () => dispatch(nav.safeNavigateUpPayload())

  return (
    <Kb.Modal
      onClose={onBack}
      header={{
        leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />,
        title: <ModalTitle teamname={props.teamname} title="Make it a big team?" />,
      }}
      allowOverflow={true}
    >
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={styles.body}
        gap={Styles.isMobile ? 'xsmall' : 'tiny'}
      >
        <Kb.RichButton
          description="With multiple roles and channels. Big team chats appear in the lower section in the inbox."
          icon="icon-teams-size-big-64"
          onClick={() => undefined} //TODO: Implement this
          title="Yes, make it a big team"
        />

        <Kb.RichButton
          description="You can always make it a big team later."
          icon="icon-teams-size-small-64"
          onClick={() => undefined} //TODO: Implement this
          title="No, keep it a simple conversation for now"
        />
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  body: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.small),
      backgroundColor: Styles.globalColors.blueGrey,
      borderRadius: 4,
    },
    isElectron: {minHeight: 326},
    isMobile: {...Styles.globalStyles.flexOne},
  }),
}))

export default MakeBigTeam
