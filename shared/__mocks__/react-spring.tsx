export const Spring = () => null
export const useSpring = <T extends {}>(c: {config?: any} & T) => {
  const {config, ...rest} = c
  return rest
}
export const animated = x => x
