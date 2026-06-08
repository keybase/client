import * as C from '@/constants'
import * as React from 'react'
import * as T from '@/constants/types'
import logger from '@/logger'

const featuredBotPageSize = 100

const mergeFeaturedBots = (
  previous: ReadonlyArray<T.RPCGen.FeaturedBot>,
  next: ReadonlyArray<T.RPCGen.FeaturedBot>
): ReadonlyArray<T.RPCGen.FeaturedBot> => {
  const byUsername = new Map(previous.map(bot => [bot.botUsername, bot] as const))
  next.forEach(bot => {
    byUsername.set(bot.botUsername, bot)
  })
  return [...byUsername.values()]
}

const pickFeaturedBot = (botUsername: string, bots: ReadonlyArray<T.RPCGen.FeaturedBot>) =>
  bots.find(bot => bot.botUsername === botUsername) ?? bots[0]

export const getFeaturedSorted = (featuredBots: ReadonlyArray<T.RPCGen.FeaturedBot>) => {
  const featured = [...featuredBots]
  featured.sort((a: T.RPCGen.FeaturedBot, b: T.RPCGen.FeaturedBot) => {
    if (a.rank < b.rank) {
      return 1
    } else if (a.rank > b.rank) {
      return -1
    }
    return 0
  })
  return featured
}

export const useFeaturedBot = (botUsername?: string) => {
  const [loadedFeaturedBot, setLoadedFeaturedBot] = React.useState<{
    bot?: T.RPCGen.FeaturedBot
    botUsername: string
  }>()
  const searchFeaturedBots = C.useRPC(T.RPCGen.featuredBotSearchRpcPromise)

  React.useEffect(() => {
    if (!botUsername) {
      return
    }

    let canceled = false
    searchFeaturedBots(
      [{limit: 10, offset: 0, query: botUsername}],
      result => {
        if (!canceled) {
          setLoadedFeaturedBot({bot: pickFeaturedBot(botUsername, result.bots ?? []), botUsername})
        }
      },
      error => {
        if (!canceled) {
          logger.info(`Featured bot load failed for ${botUsername}: ${error.message}`)
        }
      }
    )
    return () => {
      canceled = true
    }
  }, [botUsername, searchFeaturedBots])

  return loadedFeaturedBot && loadedFeaturedBot.botUsername === botUsername
    ? loadedFeaturedBot.bot
    : undefined
}

export const useFeaturedBotPage = () => {
  const [featuredBots, setFeaturedBots] = React.useState<ReadonlyArray<T.RPCGen.FeaturedBot>>([])
  const [featuredBotsPage, setFeaturedBotsPage] = React.useState(-1)
  const [loadedAllBots, setLoadedAllBots] = React.useState(false)
  const [pendingFeaturedBotsPage, setPendingFeaturedBotsPage] = React.useState<number | undefined>(0)
  const loadFeaturedBots = C.useRPC(T.RPCGen.featuredBotFeaturedBotsRpcPromise)
  const loadingBots = pendingFeaturedBotsPage !== undefined

  const loadNextBotPage = () => {
    if (loadingBots || loadedAllBots) {
      return
    }

    setPendingFeaturedBotsPage(featuredBotsPage + 1)
  }

  React.useEffect(() => {
    if (pendingFeaturedBotsPage === undefined) {
      return
    }

    let canceled = false
    loadFeaturedBots(
      [{limit: featuredBotPageSize, offset: pendingFeaturedBotsPage * featuredBotPageSize, skipCache: false}],
      result => {
        if (canceled) {
          return
        }
        const bots = result.bots ?? []
        setFeaturedBots(previous => mergeFeaturedBots(previous, bots))
        setFeaturedBotsPage(pendingFeaturedBotsPage)
        setLoadedAllBots(bots.length < featuredBotPageSize)
        setPendingFeaturedBotsPage(undefined)
      },
      error => {
        if (canceled) {
          return
        }
        logger.info(`Featured bots page load failed: ${error.message}`)
        setPendingFeaturedBotsPage(undefined)
      }
    )
    return () => {
      canceled = true
    }
  }, [loadFeaturedBots, pendingFeaturedBotsPage])

  return {featuredBots, loadNextBotPage, loadedAllBots, loadingBots}
}
