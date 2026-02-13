import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {formatTimeForFS} from '@/util/timestamp'
import {useFSState} from '@/stores/fs'
import * as FS from '@/stores/fs'

export type OwnProps = {
  path: T.FS.Path
  mode: 'row' | 'default' | 'menu'
}

const Username = ({mode, lastWriter}: {mode: OwnProps['mode']; lastWriter: string}) =>
  mode === 'row' && Kb.Styles.isMobile ? (
    <Kb.Text type="BodySmall">{lastWriter}</Kb.Text>
  ) : (
    <Kb.ConnectedUsernames
      type={mode === 'menu' ? 'BodyTinyLink' : 'BodySmallSecondaryLink'}
      usernames={lastWriter}
      inline={true}
      onUsernameClicked="profile"
      underline={true}
    />
  )

const Container = (ownProps: OwnProps) => {
  const {path, mode} = ownProps
  const _pathItem = useFSState(s => FS.getPathItem(s.pathItems, path))
  const lastModifiedTimestamp = _pathItem === FS.unknownPathItem ? undefined : _pathItem.lastModifiedTimestamp
  const lastWriter = _pathItem === FS.unknownPathItem ? undefined : _pathItem.lastWriter

  const time =
    !!lastModifiedTimestamp &&
    (mode === 'row' ? '' : 'Last modified ') + formatTimeForFS(lastModifiedTimestamp, mode !== 'row')
  const by = !!lastWriter && (
    <>
      &nbsp;by&nbsp;
      <Username mode={mode} lastWriter={lastWriter} />
    </>
  )
  switch (mode) {
    case 'menu':
      return (
        <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true}>
          <Kb.Text fixOverdraw={true} type="BodyTiny" center={true}>
            {time}
          </Kb.Text>
          <Kb.Text fixOverdraw={true} type="BodyTiny" center={true}>
            {by}
          </Kb.Text>
        </Kb.Box2>
      )
    case 'row':
      return (
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Text fixOverdraw={true} type="BodySmall" lineClamp={1}>
            {time}
            {by}
          </Kb.Text>
        </Kb.Box2>
      )
    case 'default':
      return (
        <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true}>
          <Kb.Text fixOverdraw={true} type="BodySmall" center={true}>
            {time}
            {by}
          </Kb.Text>
        </Kb.Box2>
      )
  }
}

export default Container
