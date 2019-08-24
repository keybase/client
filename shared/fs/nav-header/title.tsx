import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as Kbfs from '../common'
import * as Styles from '../../styles'
import {memoize} from '../../util/memoize'
import flags from '../../util/feature-flags'

type Props = {
  path: Types.Path
  onOpenPath: (path: Types.Path) => void
}

// /keybase/b/c => [/keybase, /keybase/b, /keybase/b/c]
const getAncestors = memoize(path =>
  path === Constants.defaultPath
    ? []
    : Types.getPathElements(path)
        .slice(1, -1)
        .reduce((list, current) => [...list, Types.pathConcat(list[list.length - 1], current)], [
          Constants.defaultPath,
        ])
)

const withAncestors = f => ({path, ...rest}) => f({ancestors: getAncestors(path), ...rest})

const Breadcrumb = Kb.OverlayParentHOC(
  withAncestors(props => (
    <Kb.Box2 direction="horizontal" fullWidth={true}>
      {props.ancestors.length > 2 && (
        <React.Fragment key="dropdown">
          <Kb.Text
            key="dots"
            type="BodyTinyLink"
            onClick={props.toggleShowingMenu}
            ref={props.setAttachmentRef}
          >
            •••
          </Kb.Text>
          <Kb.FloatingMenu
            containerStyle={styles.floating}
            attachTo={props.getAttachmentRef}
            visible={props.showingMenu}
            onHidden={props.toggleShowingMenu}
            items={props.ancestors
              .slice(0, -2)
              .reverse()
              .map(path => ({
                onClick: () => props.onOpenPath(path),
                title: Types.getPathName(path),
                view: (
                  <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
                    <Kbfs.PathItemIcon path={path} size={16} />
                    <Kb.Text type="Body" lineClamp={1}>
                      {Types.getPathName(path)}
                    </Kb.Text>
                  </Kb.Box2>
                ),
              }))}
            position="bottom left"
            closeOnSelect={true}
          />
        </React.Fragment>
      )}
      {props.ancestors.slice(-2).map(path => (
        <React.Fragment key={`text-${path}`}>
          <Kb.Text key={`slash-${Types.pathToString(path)}`} type="BodyTiny" style={styles.slash}>
            /
          </Kb.Text>
          <Kb.Text
            key={`name-${Types.pathToString(path)}`}
            type="BodyTinyLink"
            onClick={() => props.onOpenPath(path)}
          >
            {Types.getPathName(path)}
          </Kb.Text>
        </React.Fragment>
      ))}
      <Kb.Text key={`slash-end}`} type="BodyTiny" style={styles.slash}>
        /
      </Kb.Text>
    </Kb.Box2>
  ))
)

const MaybePublicTag = ({path}: {path: Types.Path}) =>
  Constants.hasPublicTag(path) ? (
    <Kb.Box2 direction="horizontal">
      <Kb.Meta title="public" backgroundColor={Styles.globalColors.green} />
    </Kb.Box2>
  ) : null

const MainTitle = (props: Props) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" gap="tiny">
    {flags.kbfsOfflineMode && Types.getPathLevel(props.path) > 2 && <Kbfs.SyncStatus path={props.path} />}
    <Kbfs.Filename path={props.path} selectable={true} style={styles.mainTitleText} type="Header" />
    <MaybePublicTag path={props.path} />
  </Kb.Box2>
)

const FsNavHeaderTitle = (props: Props) =>
  props.path === Constants.defaultPath ? (
    <Kb.Text type="Header" style={styles.rootTitle}>
      Files
    </Kb.Text>
  ) : (
    <Kb.Box2 direction="vertical" style={styles.container}>
      <Breadcrumb {...props} />
      <MainTitle {...props} />
    </Kb.Box2>
  )
export default FsNavHeaderTitle

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      marginTop: -Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.xsmall,
    },
    isElectron: Styles.desktopStyles.windowDraggingClickable,
  }),
  dropdown: {
    marginLeft: -Styles.globalMargins.tiny, // the icon has padding, so offset it to align with the name below
  },
  floating: Styles.platformStyles({
    isElectron: {
      width: 196,
    },
  }),
  icon: {
    padding: Styles.globalMargins.tiny,
  },
  mainTitleText: Styles.platformStyles({isElectron: Styles.desktopStyles.windowDraggingClickable}),
  rootTitle: {
    marginLeft: Styles.globalMargins.xsmall,
  },
  slash: {
    paddingLeft: Styles.globalMargins.xxtiny,
    paddingRight: Styles.globalMargins.xxtiny,
  },
})
