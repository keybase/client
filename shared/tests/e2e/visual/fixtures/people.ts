// The people feed's follow suggestions: server-picked. The rest of the feed is the account's own
// and passes through; only the suggestions are replaced, with the users the entry names.
import {transform, type FixtureDef} from './def.ts'

export const peopleFollowSuggestions: FixtureDef = {
  rpc: [
    transform(
      'keybase.1.home.homeGetScreen',
      (screen, _param, ctx) => ({
        ...screen,
        followSuggestions: (ctx.args['users'] as ReadonlyArray<string>).map((username, i) => ({
          bio: '',
          fullName: `Fixture ${i + 1}`,
          pics: null,
          uid: '',
          username,
        })),
      }),
      {required: true}
    ),
  ],
  teardown: 'remount',
}
