import chat2 from './chat2'
import wallets from './wallets'

export const reducers = {
  chat2,
  wallets,
}

export type TypedState = {
  chat2: ReturnType<typeof chat2>
  wallets: ReturnType<typeof wallets>
}
