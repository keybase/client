import * as React from 'react'
import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/teams'
import * as GregorGen from '../../../../actions/gregor-gen'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {TeamID} from '../../../../constants/types/teams'

export type Props = {
  teamID: TeamID
}

const Banner = ({teamID}: Props) => {
  const {teamname} = Container.useSelector(state => Constants.getTeamDetails(state, teamID))
  const shouldRender = Container.useSelector(state => !state.teams.sawSubteamsBanner)
  const dispatch = Container.useDispatch()
  const onHide = React.useCallback(
    () => dispatch(GregorGen.createUpdateCategory({body: 'true', category: 'sawSubteamsBanner'})),
    [dispatch]
  )
  if (!shouldRender) {
    return null
  }
  return (
    <Kb.Box style={styles.containerBanner}>
      <Kb.Box style={styles.containerIllustration}>
        <Kb.Icon type={Kb.Icon.makeFastType(Kb.IconType.icon_illustration_subteams_380)} />
      </Kb.Box>

      <Kb.Box style={styles.containerText}>
        <Kb.Text negative={true} type="BodySmallSemibold" style={styles.text}>
          Subteams are cryptographically distinct, and can welcome people who aren't elsewhere in your team
          hierarchy. Some random ideas:
        </Kb.Text>
        <Kb.Text negative={true} type="BodySmallSemibold">
          • {teamname}
          .devops
        </Kb.Text>
        <Kb.Text negative={true} type="BodySmallSemibold">
          • {teamname}
          .legal
        </Kb.Text>
        <Kb.Text negative={true} type="BodySmallSemibold">
          • {teamname}
          .customers.vip
        </Kb.Text>

        <Kb.Text
          negative={true}
          type="BodySmallSemiboldPrimaryLink"
          className="underline"
          onClickURL="https://keybase.io/docs/teams/design"
          style={styles.readmore}
        >
          Read more about subteams
        </Kb.Text>
      </Kb.Box>
      <Kb.Box style={styles.iconCloseContainer}>
        <Kb.Icon
          type={Kb.Icon.makeFastType(Kb.IconType.iconfont_close)}
          style={{padding: Styles.globalMargins.tiny}}
          onClick={onHide}
        />
      </Kb.Box>
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  containerBanner: Styles.platformStyles({
    common: {
      alignItems: 'center',
      backgroundColor: Styles.globalColors.blue,
      flexShrink: 0,
      justifyContent: 'center',
      position: 'relative',
      width: '100%',
    },
    isElectron: {
      ...Styles.globalStyles.flexBoxRow,
      height: 256,
    },
    isMobile: {
      ...Styles.globalStyles.flexBoxColumn,
      padding: 24,
    },
  }),
  containerIllustration: {
    ...Styles.globalStyles.flexBoxColumn,
    margin: Styles.globalMargins.small,
  },
  containerText: Styles.platformStyles({
    common: {...Styles.globalStyles.flexBoxColumn},
    isElectron: {
      marginLeft: Styles.globalMargins.medium,
      maxWidth: 330,
      paddingRight: Styles.globalMargins.small,
    },
    isMobile: {alignItems: 'center'},
  }),
  iconClose: {padding: Styles.globalMargins.tiny},
  iconCloseContainer: Styles.platformStyles({
    common: {position: 'absolute'},
    isElectron: {
      right: Styles.globalMargins.tiny,
      top: Styles.globalMargins.tiny,
    },
    isMobile: {
      right: Styles.globalMargins.small,
      top: Styles.globalMargins.small,
    },
  }),

  readmore: {
    marginTop: Styles.globalMargins.small,
  },
  text: Styles.platformStyles({
    common: {marginBottom: Styles.globalMargins.small},
    isMobile: {textAlign: 'center'},
  }),
}))

export default Banner
