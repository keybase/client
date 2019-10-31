const minBars = 20
const maxBars = 60
const snap0 = 1000 // anything under this seconds takes minBars
const snap1 = 30000 // anything over this seconds takes maxBars

export class AmpTracker {
  private buckets: Array<number> = []

  addAmp = (amp: number) => {
    this.buckets.push(amp)
  }

  private curve = (v: number) => {
    // this function should take values between 0 and 1
    // and return values between 0 and 1. It can just return number,
    // or it could do something like sqrt(number) or number^2 or whatever.
    return Math.sqrt(v)
  }

  private bucketPass = (amps: Array<number>, maxBuckets: number) => {
    let consumed = 0
    const res: Array<number> = []
    for (let i = 0; i < amps.length; i++) {
      if (amps.length - consumed > maxBuckets && i < amps.length - 1) {
        res.push((amps[i] + amps[i + 1]) / 2)
        consumed += 2
        i++
      } else {
        res.push(amps[i])
        consumed++
      }
    }
    return res
  }

  private getNumBars = (duration: number) => {
    const frac = (duration - snap0) / (snap1 - snap0)
    if (frac < 0) {
      return minBars
    }
    if (frac > 1) {
      return maxBars
    }
    const k = this.curve(frac)
    // finally scale it:
    const bars = minBars + (maxBars - minBars) * k
    return Math.floor(bars)
  }

  getBucketedAmps = (duration: number): Array<number> => {
    const maxBuckets = this.getNumBars(duration)
    let res: Array<number> = this.buckets
    for (let i = 0; i < 20; i++) {
      if (res.length <= maxBuckets) {
        return res
      }
      res = this.bucketPass(res, maxBuckets)
    }
    return res
  }

  reset = () => {
    this.buckets = []
  }
}
