import * as C from '@/constants'
import * as Kb from '@/common-adapters'

export const HeaderTitle = () => {
  const readHowUrlProps = Kb.useClickURL('https://keybase.io/blog/encrypted-git-for-everyone')
  return (
    <Kb.Box2
      direction="vertical"
      alignItems="flex-start"
      flex={1}
      style={styles.headerTitle}
      className="hover-underline-container"
    >
      <Kb.Text type="Header">Git repositories</Kb.Text>
      <Kb.Text type="BodySmall">
        All repositories are end-to-end encrypted.{' '}
        <Kb.Text
          type="BodySmall"
          {...readHowUrlProps}
          style={styles.headerTitleLink}
          className="hover-underline-child"
        >
          Read how it works.
        </Kb.Text>
      </Kb.Text>
    </Kb.Box2>
  )
}

export const HeaderRightActions = () => {
  const navigateAppend = C.Router2.navigateAppend

  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    const onAddPersonal = () => {
      navigateAppend({name: 'gitNewRepo', params: {isTeam: false}})
    }
    const onAddTeam = () => {
      navigateAppend({name: 'gitNewRepo', params: {isTeam: true}})
    }

    return (
      <Kb.FloatingMenu
        closeOnSelect={true}
        visible={true}
        onHidden={hidePopup}
        position="bottom center"
        items={[
          {icon: 'iconfont-person', onClick: onAddPersonal, title: 'New personal repository'},
          {icon: 'iconfont-people', onClick: onAddTeam, title: 'New team repository'},
        ]}
        {...(attachTo === undefined ? {} : {attachTo})}
      />
    )
  }

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
