import React from 'react'
import * as RPCTypes from '../../../../constants/types/rpc-gen'
import * as Types from '../../../../constants/types/chat2'
import * as Sb from '../../../../stories/storybook'
import Git from '.'
import * as Constants from '../../../../constants/chat2/message'

const commit = {
  authorEmail: 'email@email.com',
  authorName: 'author',
  commitHash: 'hash1',
  ctime: new Date('1/1/1999').getTime(),
  message: 'message1 this is a message blah blah blah end.',
}

const messageShared = {
  author: 'chris',
  id: 1,
  ordinal: Types.numberToOrdinal(1),
  pusher: 'chris',
  timestamp: new Date('1/1/1999').getTime(),
}

const message = Constants.makeMessageSystemGitPush({
  ...messageShared,
  pushType: RPCTypes.GitPushType.default,
  refs: [
    {
      commits: [commit],
      isDelete: false,
      moreCommitsAvailable: false,
      refName: 'ref1',
    },
  ],
})

const noCommits = message.set('refs', [{...message.refs[0], commits: []}])

const lotsCommits = message.set('refs', [
  {
    ...message.refs[0],
    commits: new Array(50).fill(null).map((_, idx) => ({
      ...commit,
      commitHash: `hash${idx}`,
      message: new Array((idx % 20) + 1).fill('a word').join(' '),
    })),
  },
])

const longMessage = message
  .setIn(
    ['refs', '0', 'commits', '0', 'message'],
    'this is a very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long  very long very long message.'
  )
  .setIn(['refs', '0', 'commits', '1'], {
    ...commit,
    message:
      'this is a very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long  very long very long message.',
  })
  .setIn(['refs', '0', 'commits', '2'], {
    ...commit,
    message: 'kinda short',
  })
  .setIn(['refs', '0', 'commits', '3'], {
    ...commit,
    message:
      'this is a very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long very long  very long very long message.',
  })

const multiRefMessage = message
  .setIn(['refs', '1'], {...message.refs[0], refName: 'ref2'})
  .setIn(['refs', '2'], {...message.refs[0], refName: 'ref3'})

const messageCreate = Constants.makeMessageSystemGitPush({
  ...messageShared,
  pushType: RPCTypes.GitPushType.createrepo,
  repo: 'repoName',
})

const messageRename = Constants.makeMessageSystemGitPush({
  ...messageShared,
  pushType: RPCTypes.GitPushType.renamerepo,
})

const common = {
  onClickCommit: Sb.action('onClickCommit'),
  onClickUserAvatar: Sb.action('onClickUserAvatar'),
  onViewGitRepo: Sb.action('onViewGitRepo'),
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/Rows/Git', module)
    .add('Default', () => <Git {...common} message={message} />)
    .add('0 commits', () => <Git {...common} message={noCommits} />)
    .add('50 commits', () => <Git {...common} message={lotsCommits} />)
    .add('Long message', () => <Git {...common} message={longMessage} />)
    .add('Multi Ref', () => <Git {...common} message={multiRefMessage} />)
    .add('Create', () => <Git {...common} message={messageCreate} />)
    .add('Rename', () => <Git {...common} message={messageRename} />)
}

export default load
