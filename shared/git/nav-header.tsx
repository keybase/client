import * as C from '@/constants'
import * as Git from '@/stores/git'
import * as React from 'react'
import * as Kb from '@/common-adapters'

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
  const setError = Git.useGitState(s => s.dispatch.setError)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      const onAddPersonal = () => {
        setError(undefined)
        navigateAppend({props: {isTeam: false}, selected: 'gitNewRepo'})
      }
      const onAddTeam = () => {
        setError(undefined)
        navigateAppend({props: {isTeam: true}, selected: 'gitNewRepo'})
      }

      return (
        <Kb.FloatingMenu
          attachTo={attachTo}
          closeOnSelect={true}
          visible={true}
          onHidden={hidePopup}
          position="bottom center"
          items={[
            {icon: 'iconfont-person', onClick: onAddPersonal, title: 'New personal repository'},
            {icon: 'iconfont-people', onClick: onAddTeam, title: 'New team repository'},
          ]}
        />
      )
    },
    [navigateAppend, setError]
  )

  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)
  return (
    <>
      <Kb.Button
        label="New repository"
        onClick={showPopup}
        small={true}
        ref={popupAnchor}
        style={styles.newRepoButton}
      />
      {popup}
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  headerTitle: {
    flex: 1,
    paddingBottom: Kb.Styles.globalMargins.xtiny,
    paddingLeft: Kb.Styles.globalMargins.xsmall,
  },
  headerTitleLink: Kb.Styles.platformStyles({
    isElectron: {...Kb.Styles.desktopStyles.windowDraggingClickable, cursor: 'pointer'},
  }),
  newRepoButton: Kb.Styles.platformStyles({
    common: {alignSelf: 'flex-end', marginBottom: 6, marginRight: Kb.Styles.globalMargins.xsmall},
    isElectron: Kb.Styles.desktopStyles.windowDraggingClickable,
  }),
}))
