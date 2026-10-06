// Featured bots: server-picked and server-ranked. The list is replaced with bots the entry names,
// on one page.
import type * as T from '@/constants/types'
import {stub, type FixtureDef} from './def.ts'

const bot = (botUsername: string, rank: number): T.RPCGen.FeaturedBot => ({
  botAlias: `Fixture bot ${rank}`,
  botUsername,
  description: `A featured bot the visual gate supplies (${rank}).`,
  extendedDescription: '',
  extendedDescriptionRaw: '',
  isPromoted: false,
  ownerTeam: null,
  ownerUser: null,
  rank,
})

export const featuredBots: FixtureDef = {
  rpc: [
    stub(
      'keybase.1.featuredBot.featuredBots',
      (_param, ctx) => ({
        bots: (ctx.args['bots'] as ReadonlyArray<string>).map((name, i, all) => bot(name, all.length - i)),
        isLastPage: true,
      }),
      {required: true}
    ),
  ],
  teardown: 'remount',
}
