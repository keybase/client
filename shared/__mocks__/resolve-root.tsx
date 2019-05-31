if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}
export const resolveRoot = (...to: any) => to.join('/')
export const resolveRootAsURL = (...to: any) => to.join('/')
export const resolveImage = (...to: any) => to.join('/')
export const resolveImageAsURL = (...to: any) => to.join('/')

export default resolveRoot
