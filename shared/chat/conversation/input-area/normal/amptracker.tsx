import chunk from 'lodash/chunk'

export class AmpTracker {
  private numBuckets: number
  private buckets: Array<number> = []
  constructor(numBuckets: number) {
    this.numBuckets = numBuckets
  }

  addAmp = (amp: number) => {
    this.buckets.push(amp)
  }

  getBucketedAmps = (): Array<number> => {
    const chunkSize = Math.max(1, Math.floor(this.buckets.length / this.numBuckets))
    const chunks = chunk(this.buckets, chunkSize)
    return chunks.reduce((l, c) => {
      l.push(
        c.reduce((a, b) => {
          return a + b
        }, 0) / c.length
      )
      return l
    }, [])
  }

  reset = () => {
    this.buckets = []
  }
}
