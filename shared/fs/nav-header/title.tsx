import * as React from 'react'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as Kbfs from '../common'
import {useSafeNavigation} from '@/util/safe-navigation'
import * as FS from '@/stores/fs'

type Props = {
  destinationPickerSource?: T.FS.MoveOrCopySource | T.FS.IncomingShareSource | undefined
  path: T.FS.Path
  inDestinationPicker?: boolean | undefined
}

const Breadcrumb = (props: Props) => {
  const apath = props.path || FS.defaultPath
  // /keybase/b/c => [/keybase, /keybase/b, /keybase/b/c]
  const ancestors =
    apath === FS.defaultPath
      ? []
      : T.FS.getPathElements(apath)
          .slice(1, -1)
          .reduce((list, current) => [...list, T.FS.pathConcat(list.at(-1), current)], [FS.defaultPath])
  const {inDestinationPicker} = props
  const nav = useSafeNavigation()
  const onOpenPath = (path: T.FS.Path) => {
    if (inDestinationPicker) {
      if (props.destinationPickerSource) {
        nav.safeNavigateAppend({
          name: 'destinationPicker',
          params: {parentPath: path, source: props.destinationPickerSource},
        })
      }
    } else {
      nav.safeNavigateAppend({name: 'fsRoot', params: {path}})
    }
  }

  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    return (
      <Kb.FloatingMenu
        containerStyle={styles.floating}
        visible={true}
        onHidden={hidePopup}
        items={ancestors
          .slice(0, -2)
          .reverse()
          .map(path => ({
            onClick: () => onOpenPath(path),
            title: T.FS.getPathName(path),
            view: (
              <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
                <Kbfs.ItemIcon path={path} size={16} />
                <Kb.Text type="Body" lineClamp={1}>
                  {T.FS.getPathName(path)}
                </Kb.Text>
              </Kb.Box2>
            ),
          }))}
        position="bottom left"
        closeOnSelect={true}
        {...(attachTo === undefined ? {} : {attachTo})}
      />
    )
  }

  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  return (
    <Kb.Box2 direction="horizontal" fullWidth={true}>
      {ancestors.length > 2 && (
        <React.Fragment key="dropdown">
          <Kb.Text key="dots" type="BodyTinyLink" onClick={showPopup} textRef={popupAnchor}>
            •••
          </Kb.Text>
          {popup}
        </React.Fragment>
      )}
      {ancestors.slice(-2).map(path => (
        <React.Fragment key={`text-${path}`}>
          <Kb.Text key={`slash-${T.FS.pathToString(path)}`} type="BodyTiny" style={styles.slash}>
            /
          </Kb.Text>
          <Kb.Text
            key={`name-${T.FS.pathToString(path)}`}
            type="BodyTinyLink"
            onClick={() => onOpenPath(path)}
          >
            {T.FS.getPathName(path)}
          </Kb.Text>
        </React.Fragment>
      ))}
      <Kb.Text key={`slash-end}`} type="BodyTiny" style={styles.slash}>
        /
      </Kb.Text>
    </Kb.Box2>
  )
}

const MaybePublicTag = ({path}: {path: T.FS.Path}) =>
  FS.hasPublicTag(path) ? (
    <Kb.Box2 direction="horizontal">
      <Kb.Meta title="public" backgroundColor={Kb.Styles.globalColors.green} />
    </Kb.Box2>
  ) : null

const MainTitle = (props: Props) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" gap="tiny">
    <Kbfs.PathStatusIcon path={props.path} />
    <Kbfs.Filename path={props.path} selectable={true} style={styles.mainTitleText} type="Header" />
    <MaybePublicTag path={props.path} />
  </Kb.Box2>
)

const FsNavHeaderTitleInner = (props: Props) =>
  props.path === FS.defaultPath ? (
    <Kb.Text type="Header" style={styles.rootTitle}>
      Files
    </Kb.Text>
  ) : (
    <Kb.Box2 direction="vertical" style={styles.container}>
      <Breadcrumb {...props} />
      <MainTitle {...props} />
    </Kb.Box2>
  )

const FsNavHeaderTitle = (props: Props) => (
  <Kbfs.FsErrorProvider>
    <Kbfs.FsDataProvider>
      <FsNavHeaderTitleInner {...props} />
    </Kbfs.FsDataProvider>
  </Kbfs.FsErrorProvider>
)

export default FsNavHeaderTitle

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        common: {
          marginTop: -Kb.Styles.globalMargins.tiny,
          paddingLeft: Kb.Styles.globalMargins.xsmall,
        },
        isElectron: Kb.Styles.desktopStyles.windowDraggingClickable,
      }),
      floating: Kb.Styles.platformStyles({
        isElectron: {
          width: 196,
        },
      }),
      mainTitleText: Kb.Styles.platformStyles({isElectron: Kb.Styles.desktopStyles.windowDraggingClickable}),
      rootTitle: {
        alignSelf: 'center',
        marginLeft: Kb.Styles.globalMargins.xsmall,
      },
      slash: {
        paddingLeft: Kb.Styles.globalMargins.xxtiny,
        paddingRight: Kb.Styles.globalMargins.xxtiny,
      },
    }) as const
)
