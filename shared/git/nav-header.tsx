import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Container from '../util/container'
import * as Constants from '../constants/git'
import * as RouteTreeGen from '../actions/route-tree-gen'

export const HeaderTitle = () => (
  <Kb.Box2
    direction="vertical"
    alignItems="flex-start"
    style={styles.headerTitle}
    className="hover-underline-container"
  >
    <Kb.Text type="Header">Git repositories</Kb.Text>
    <Kb.Text type="BodySmall">
      All repositories are end-to-end encrypted.{' '}
      <Kb.Text
        type="BodySmall"
        onClickURL="https://keybase.io/blog/encrypted-git-for-everyone"
        style={styles.headerTitleLink}
        className="hover-underline-child"
      >
        Read how it works.
      </Kb.Text>
    </Kb.Text>
  </Kb.Box2>
)

export const HeaderRightActions = () => {
  const dispatch = Container.useDispatch()

  const dispatchSetError = Constants.useGitState(state => state.dispatchSetError)

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, toggleShowingPopup} = p
      const onAddPersonal = () => {
        dispatchSetError(undefined)
        dispatch(
          RouteTreeGen.createNavigateAppend({path: [{props: {isTeam: false}, selected: 'gitNewRepo'}]})
        )
      }
      const onAddTeam = () => {
        dispatchSetError(undefined)
        dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {isTeam: true}, selected: 'gitNewRepo'}]}))
      }

      return (
        <Kb.FloatingMenu
          attachTo={attachTo}
          closeOnSelect={true}
          visible={true}
          onHidden={toggleShowingPopup}
          position="bottom center"
          positionFallbacks={[]}
          items={[
            {icon: 'iconfont-person', onClick: onAddPersonal, title: 'New personal repository'},
            {icon: 'iconfont-people', onClick: onAddTeam, title: 'New team repository'},
          ]}
        />
      )
    },
    [dispatch, dispatchSetError]
  )

  const {toggleShowingPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)
  return (
    <>
      <Kb.Button
        label="New repository"
        onClick={toggleShowingPopup}
        small={true}
        ref={popupAnchor}
        style={styles.newRepoButton}
      />
      {popup}
    </>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  headerTitle: {flex: 1, paddingBottom: Styles.globalMargins.xtiny, paddingLeft: Styles.globalMargins.xsmall},
  headerTitleLink: Styles.platformStyles({
    isElectron: {...Styles.desktopStyles.windowDraggingClickable, cursor: 'pointer'},
  }),
  newRepoButton: Styles.platformStyles({
    common: {alignSelf: 'flex-end', marginBottom: 6, marginRight: Styles.globalMargins.xsmall},
    isElectron: Styles.desktopStyles.windowDraggingClickable,
  }),
}))
