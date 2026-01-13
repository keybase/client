import * as C from '@/constants'
import * as React from 'react'
import * as T from '@/constants/types'
import {folderNameWithoutUsers} from '@/util/kbfs'
import * as Kb from '@/common-adapters'
import * as RowTypes from '@/fs/browser/rows/types'
import {useTrackerState} from '@/stores/tracker2'
import {useFSState} from '@/stores/fs'
import * as FS from '@/stores/fs'
import {useProfileState} from '@/stores/profile'

type OwnProps = {path: T.FS.Path}

const ConnectedBanner = (ownProps: OwnProps) => {
  const {path} = ownProps
  const _tlf = useFSState(s => FS.getTlfFromPath(s.tlfs, path))
  const letResetUserBackIn = useFSState(s => s.dispatch.letResetUserBackIn)
  const _onOpenWithoutResetUsers = React.useCallback(
    (currPath: T.FS.Path, users: {[K in string]: boolean}) => {
      const pathElems = T.FS.getPathElements(currPath)
      if (pathElems.length < 3) return
      const filteredPathName = folderNameWithoutUsers(pathElems[2] ?? '', users)
      const filteredPath = T.FS.stringToPath(['', pathElems[0], pathElems[1], filteredPathName].join('/'))
      FS.navToPath(filteredPath)
    },
    []
  )
  const _onReAddToTeam = React.useCallback(
    (id: T.RPCGen.TeamID, username: string) => {
      letResetUserBackIn(id, username)
    },
    [letResetUserBackIn]
  )
  const showUserProfile = useProfileState(s => s.dispatch.showUserProfile)

  const showUser = useTrackerState(s => s.dispatch.showUser)
  const onViewProfile = React.useCallback(
    (username: string) => () => {
      C.isMobile ? showUserProfile(username) : showUser(username, true)
    },
    [showUser, showUserProfile]
  )
  const onOpenWithoutResetUsers = () =>
    _onOpenWithoutResetUsers(
      path,
      _tlf.resetParticipants.reduce<{
        [x: string]: boolean
      }>((acc, i: string) => {
        acc[i] = true
        return acc
      }, {})
    )
  const onReAddToTeam = (username: string) => () =>
    _tlf.teamId ? _onReAddToTeam(_tlf.teamId, username) : undefined
  const resetParticipants = _tlf.resetParticipants

  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      centerChildren={true}
      style={Kb.Styles.collapseStyles([styles.banner, fixedHeight(getHeight(resetParticipants.length))])}
    >
      <Kb.Icon
        type={C.isMobile ? 'icon-skull-64' : 'icon-skull-48'}
        style={{height: Kb.Styles.globalMargins.xlarge, margin: Kb.Styles.globalMargins.medium}}
      />
      <Kb.Box2 direction="vertical" centerChildren={true} style={styles.textIntro}>
        <Kb.Text type="BodySemibold" negative={true}>
          <Kb.ConnectedUsernames
            type="BodySemiboldLink"
            showAnd={true}
            inline={true}
            inlineGrammar={true}
            commaColor={Kb.Styles.globalColors.white}
            onUsernameClicked="profile"
            underline={true}
            usernames={resetParticipants}
            backgroundMode="Terminal"
          />
          &nbsp;
          {
            // This needs to be in the same node as the sister
            // ConnectedUsernames node, because otherwise it gets re-flowed
            // awkwardly.
            'lost all of their devices and ' +
              (resetParticipants.length === 1 ? 'this account has' : 'these accounts have') +
              ' new keys.'
          }
        </Kb.Text>
        <Kb.Text type="BodySemibold" negative={true}>
          If you want to let them into this folder and the matching chat, you should either:
        </Kb.Text>
      </Kb.Box2>
      <Kb.Box2 direction="vertical" style={styles.listTextContainer}>
        <Kb.Text type="BodySemibold" negative={true} style={styles.listTextContent}>
          1. Be satisfied with their new proofs, or
        </Kb.Text>
        <Kb.Text type="BodySemibold" negative={true} style={styles.listTextContent}>
          2. Know them outside Keybase and have gotten a thumbs up from them.
        </Kb.Text>
      </Kb.Box2>
      <Kb.Box2 direction="vertical" centerChildren={true} style={styles.textDontLetThemIn}>
        <Kb.Text type="BodySemibold" negative={true}>
          {"Don't let them in until one of those is true."}
        </Kb.Text>
      </Kb.Box2>
      <Kb.Box2 direction="vertical" gap="small">
        {resetParticipants.map(p => (
          <Kb.Box2 direction={C.isMobile ? 'vertical' : 'horizontal'} key={p} gap="tiny">
            <Kb.Button
              mode="Secondary"
              backgroundColor="red"
              label={'View ' + p + "'s profile"}
              onClick={onViewProfile(p)}
              style={styles.button}
            />
            <Kb.Button
              type="Danger"
              backgroundColor="red"
              label={'Let ' + p + ' back in'}
              onClick={onReAddToTeam(p)}
              style={styles.button}
            />
          </Kb.Box2>
        ))}
      </Kb.Box2>
      {resetParticipants.length > 1 && (
        <Kb.Text type="BodySemibold" negative={true} style={styles.textOrUntil}>
          {"Or until you're sure, "}
          <Kb.Text type="BodySemiboldLink" negative={true} onClick={onOpenWithoutResetUsers}>
            open a folder without any of them.
          </Kb.Text>
        </Kb.Text>
      )}
    </Kb.Box2>
  )
}

const noRows = new Array<RowTypes.HeaderRowItem>()
export const asRows = (
  path: T.FS.Path,
  resetBannerType: T.FS.ResetBannerType
): Array<RowTypes.HeaderRowItem> =>
  typeof resetBannerType === 'number'
    ? [
        {
          height: getHeight(resetBannerType),
          key: 'reset-banner',
          node: <ConnectedBanner path={path} />,
          rowType: RowTypes.RowType.Header,
        },
      ]
    : noRows

/*
 * This banner is used as part of a List2 in fs/folder/rows/rows.js, so it's
 * important to keep height stable, thus all the height/minHeight/maxHeight in
 * styles.  Please make sure the height is still calculated in getHeight when
 * layout changes.
 *
 */
const addedHeightPerResetUser = C.isMobile
  ? 2 * Kb.Styles.globalMargins.large + Kb.Styles.globalMargins.tiny + Kb.Styles.globalMargins.small
  : Kb.Styles.globalMargins.large + Kb.Styles.globalMargins.tiny
const baseHeight = C.isMobile ? 440 : 378 // Change this when layout changes
export const getHeight = (numResetUsers: number) => baseHeight + numResetUsers * addedHeightPerResetUser

const fixedHeight = (height: number) => ({
  height,
  maxHeight: height,
  minHeight: height,
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      banner: {
        backgroundColor: Kb.Styles.globalColors.red,
        padding: Kb.Styles.globalMargins.medium,
      },
      button: Kb.Styles.platformStyles({
        isElectron: {width: Kb.Styles.globalMargins.xlarge * 4},
        isMobile: {width: Kb.Styles.globalMargins.xlarge * 5},
      }),
      listTextContainer: {
        ...fixedHeight(C.isMobile ? Kb.Styles.globalMargins.large * 3 : Kb.Styles.globalMargins.large * 2),
        justifyContent: 'center',
        maxWidth: C.isMobile ? 280 : 400,
      },
      listTextContent: {marginTop: Kb.Styles.globalMargins.tiny},
      textDontLetThemIn: {
        ...fixedHeight(Kb.Styles.globalMargins.mediumLarge),
        marginBottom: Kb.Styles.globalMargins.tiny,
      },
      textIntro: fixedHeight(Kb.Styles.globalMargins.xlarge + Kb.Styles.globalMargins.small),
      textOrUntil: {marginTop: Kb.Styles.globalMargins.small},
    }) as const
)
