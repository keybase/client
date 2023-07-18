import chat2 from './chat2'

export const reducers = {
  chat2,
}

export type TypedState = {
  chat2: ReturnType<typeof chat2>
}
