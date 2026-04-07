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
  const [featuredBot, setFeaturedBot] = React.useState<T.RPCGen.FeaturedBot>()
  const searchFeaturedBots = C.useRPC(T.RPCGen.featuredBotSearchRpcPromise)

  React.useEffect(() => {
    if (!botUsername) {
      setFeaturedBot(undefined)
      return
    }

    searchFeaturedBots(
      [{limit: 10, offset: 0, query: botUsername}],
      result => {
        setFeaturedBot(pickFeaturedBot(botUsername, result.bots ?? []))
      },
      error => {
        logger.info(`Featured bot load failed for ${botUsername}: ${error.message}`)
      }
    )
  }, [botUsername, searchFeaturedBots])

  return featuredBot
}

export const useFeaturedBotPage = () => {
  const [featuredBots, setFeaturedBots] = React.useState<ReadonlyArray<T.RPCGen.FeaturedBot>>([])
  const [featuredBotsPage, setFeaturedBotsPage] = React.useState(-1)
  const [loadedAllBots, setLoadedAllBots] = React.useState(false)
  const [loadingBots, setLoadingBots] = React.useState(false)
  const loadFeaturedBots = C.useRPC(T.RPCGen.featuredBotFeaturedBotsRpcPromise)

  const loadNextBotPage = React.useCallback(() => {
    if (loadingBots || loadedAllBots) {
      return
    }

    const nextPage = featuredBotsPage + 1
    setLoadingBots(true)
    loadFeaturedBots(
      [{limit: featuredBotPageSize, offset: nextPage * featuredBotPageSize, skipCache: false}],
      result => {
        const bots = result.bots ?? []
        setFeaturedBots(previous => mergeFeaturedBots(previous, bots))
        setFeaturedBotsPage(nextPage)
        setLoadedAllBots(bots.length < featuredBotPageSize)
        setLoadingBots(false)
      },
      error => {
        logger.info(`Featured bots page load failed: ${error.message}`)
        setLoadingBots(false)
      }
    )
  }, [featuredBotsPage, loadFeaturedBots, loadedAllBots, loadingBots])

  React.useEffect(() => {
    if (featuredBotsPage === -1 && !loadedAllBots) {
      loadNextBotPage()
    }
  }, [featuredBotsPage, loadedAllBots, loadNextBotPage])

  return {featuredBots, loadNextBotPage, loadedAllBots, loadingBots}
}
