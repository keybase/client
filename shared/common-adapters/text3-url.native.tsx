import openURL from '@/util/open-url'

export function useClickURL(url: string | undefined) {
  if (!url) return {} as const
  return {
    onClick: () => {
      openURL(url)
    },
  } as const
}
