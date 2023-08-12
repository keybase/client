import * as C from '../../constants'
import * as Constants from '../../constants/fs'
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Kb from '../../common-adapters'
import * as Kbfs from '../common'
import * as Styles from '../../styles'
import {memoize} from '../../util/memoize'
import * as Container from '../../util/container'

type Props = {
  path: Types.Path
  inDestinationPicker?: boolean
}

// /keybase/b/c => [/keybase, /keybase/b, /keybase/b/c]
const getAncestors = memoize(path =>
  path === C.defaultPath
    ? []
    : Types.getPathElements(path)
        .slice(1, -1)
        .reduce(
          (list, current) => [...list, Types.pathConcat(list[list.length - 1], current)],
          [C.defaultPath]
        )
)

const Breadcrumb = (props: Props) => {
  const ancestors = getAncestors(props.path || C.defaultPath)
  const {inDestinationPicker} = props
  const nav = Container.useSafeNavigation()
  const onOpenPath = React.useCallback(
    (path: Types.Path) => {
      inDestinationPicker
        ? C.makeActionsForDestinationPickerOpen(0, path)
        : nav.safeNavigateAppend({props: {path}, selected: 'fsRoot'})
    },
    [nav, inDestinationPicker]
  )

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, toggleShowingPopup} = p
      return (
        <Kb.FloatingMenu
          containerStyle={styles.floating}
          attachTo={attachTo}
          visible={true}
          onHidden={toggleShowingPopup}
          items={ancestors
            .slice(0, -2)
            .reverse()
            .map(path => ({
              onClick: () => onOpenPath(path),
              title: Types.getPathName(path),
              view: (
                <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
                  <Kbfs.ItemIcon path={path} size={16} />
                  <Kb.Text type="Body" lineClamp={1}>
                    {Types.getPathName(path)}
                  </Kb.Text>
                </Kb.Box2>
              ),
            }))}
          position="bottom left"
          closeOnSelect={true}
        />
      )
    },
    [ancestors, onOpenPath]
  )

  const {toggleShowingPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  return (
    <Kb.Box2 direction="horizontal" fullWidth={true}>
      {ancestors.length > 2 && (
        <React.Fragment key="dropdown">
          <Kb.Text key="dots" type="BodyTinyLink" onClick={toggleShowingPopup} ref={popupAnchor as any}>
            •••
          </Kb.Text>
          {popup}
        </React.Fragment>
      )}
      {ancestors.slice(-2).map(path => (
        <React.Fragment key={`text-${path}`}>
          <Kb.Text key={`slash-${Types.pathToString(path)}`} type="BodyTiny" style={styles.slash}>
            /
          </Kb.Text>
          <Kb.Text
            key={`name-${Types.pathToString(path)}`}
            type="BodyTinyLink"
            onClick={() => onOpenPath(path)}
          >
            {Types.getPathName(path)}
          </Kb.Text>
        </React.Fragment>
      ))}
      <Kb.Text key={`slash-end}`} type="BodyTiny" style={styles.slash}>
        /
      </Kb.Text>
    </Kb.Box2>
  )
}

const MaybePublicTag = ({path}: {path: Types.Path}) =>
  Constants.hasPublicTag(path) ? (
    <Kb.Box2 direction="horizontal">
      <Kb.Meta title="public" backgroundColor={Styles.globalColors.green} />
    </Kb.Box2>
  ) : null

const MainTitle = (props: Props) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" gap="tiny">
    <Kbfs.PathStatusIcon path={props.path} />
    <Kbfs.Filename path={props.path} selectable={true} style={styles.mainTitleText} type="Header" />
    <MaybePublicTag path={props.path} />
  </Kb.Box2>
)

const FsNavHeaderTitle = (props: Props) =>
  props.path === C.defaultPath ? (
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
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
        alignSelf: 'center',
        marginLeft: Styles.globalMargins.xsmall,
      },
      slash: {
        paddingLeft: Styles.globalMargins.xxtiny,
        paddingRight: Styles.globalMargins.xxtiny,
      },
    }) as const
)
