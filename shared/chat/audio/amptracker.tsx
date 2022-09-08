import {maxAmpsLength} from '../../constants/chat2/message'
const minBars = 20
const maxBars = maxAmpsLength
const snap0 = 1000 // anything under this seconds takes minBars
const snap1 = 30000 // anything over this seconds takes maxBars

export class AmpTracker {
  private amps: Array<number> = []

  addAmp = (amp: number) => {
    this.amps.push(amp)
  }

  private curve = (v: number) => {
    // this function should take values between 0 and 1
    // and return values between 0 and 1. It can just return number,
    // or it could do something like sqrt(number) or number^2 or whatever.
    return Math.sqrt(v)
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

  private getBucketList = (): BucketList => {
    return this.amps.reduce((bl, b, index) => {
      bl.addBucket(new Bucket(100 * index, 100, b))
      return bl
    }, new BucketList())
  }

  getBucketedAmps = (duration: number): Array<number> => {
    const buckets = this.getBucketList()
    const maxBuckets = this.getNumBars(duration)
    const resInterval = duration / maxBuckets
    const scaledBuckets = buckets.rescaleToNewBucketList(resInterval)
    return scaledBuckets.buckets.reduce<Array<number>>((arr, b) => {
      arr.push(b.v)
      return arr
    }, [])
  }

  reset = () => {
    this.amps = []
  }
}

class Bucket {
  private startTime: number
  private duration: number
  public v: number
  constructor(startTime: number, duration: number, v: number) {
    this.startTime = startTime
    this.duration = duration
    this.v = v
  }

  end = () => {
    return this.startTime + this.duration
  }
  start = () => {
    return this.startTime
  }
  toString = () => `${this.start()} \t ${this.end()} \t VALUE = ${this.v}`
}

const fractionOfAThatIsOnB = (a: Bucket, b: Bucket) => {
  // fraction of a bucket "a" that is on top of another bucket "b". For example, if A entirely
  // happens during B (even if B is longer), this would be a 1.
  // If 25% of the time A is happening,  B also is, then this returns 0.25.
  //
  // There are actually 6 scenarios we need to cover. Drawing them out as timelines:
  //
  const a0 = a.start()
  const a1 = a.end()
  const b0 = b.start()
  const b1 = b.end()

  // ----------------------------------------//
  // 1.    AAAAAAAA                          //
  //                 BBBBBBBBB               //
  // --------------------------------------  //
  if (a1 <= b0) {
    return 0
  }
  // ----------------------------------------//
  // 2.                 AAAAAAAA             //
  //         BBBBBBBBB                       //
  // --------------------------------------  //
  if (b1 <= a0) {
    return 0
  }
  // ----------------------------------------//
  // 3.   AAAAAAAA                           //
  //            BBBBBBBBB                    //
  // --------------------------------------  //
  if (a0 <= b0 && a1 <= b1) {
    return (a1 - b0) / (a1 - a0)
  }
  // ----------------------------------------//
  // 4.   AAAAAAAAAAAAAAAAAA                 //
  //            BBBBBBBBB                    //
  // --------------------------------------  //
  if (a0 <= b0 && a1 >= b1) {
    return (b1 - b0) / (a1 - a0)
  }
  // ----------------------------------------//
  // 5.           AAAA                       //
  //            BBBBBBBBB                    //
  // --------------------------------------  //
  if (a0 >= b0 && a1 <= b1) {
    return 1
  }
  // ----------------------------------------//
  // 6.           AAAAAAAAAA                 //
  //            BBBBBBBBB                    //
  // --------------------------------------  //
  if (a0 >= b0 && a1 >= b1) {
    return (b1 - a0) / (a1 - a0)
  }

  return 0
}

// ---------------------------------------------------------

class BucketList {
  public buckets: Array<Bucket>
  constructor() {
    this.buckets = []
  }

  addBucket = (b: Bucket) => {
    this.buckets.push(b)
  }

  rescaleToNewBucketList = (dt: number) => {
    // return a new BucketList, where every bucket is dt
    // units long
    if (!this.buckets.length) {
      return new BucketList()
    }
    const newBl = new BucketList()
    let t = 0
    const end = this.buckets[this.buckets.length - 1].end()
    let oldInd = 0 // an index into the old buckets. For performance reasons, we'll also move across this
    while (t < end) {
      const b = new Bucket(t, dt, 0)
      newBl.addBucket(b)
      let vTotal = 0
      let fTotal = 0
      while (oldInd < this.buckets.length && this.buckets[oldInd].start() < b.end()) {
        const oldBucket = this.buckets[oldInd]
        const frac = fractionOfAThatIsOnB(b, oldBucket)
        vTotal += oldBucket.v * frac
        fTotal += frac
        oldInd++
      }
      oldInd-- // backtrack once to allow for bucket sharing
      if (fTotal > 0) {
        b.v = vTotal / fTotal
      } else {
        b.v = 0 // or whatever we want...0? (This only happens if original bucket list has gaps.)
      }
      t = Math.min(t + dt, end)
    }
    return newBl
  }
}

// ---------------------------------------------------------
// LET'S TEST IT! Play with these values
// ---------------------------------------------------------

/*
DURATION = 1000 + Math.random() * 1000
ORIG_BUCKET_SIZE_FN = -> Math.floor(Math.random() * 100)
TARGET_BUCKET_DT = 100 // what we're rescaling to

// ---------------------------------------------------------

bl = new BucketList
t = 0
while t < DURATION
  dt = ORIG_BUCKET_SIZE_FN()
  v  = Math.floor(Math.random() * Math.random() * 100)
  b  = new Bucket(t, dt, v)
  bl.addBucket b
  t += dt
console.log("ORIGINAL:")
bl.print()

startTime = Date.now()
rescaled = bl.rescaleToNewBucketList(TARGET_BUCKET_DT)
console.log("\n\nRESCALED IN //{Date.now() - startTime}ms:")
rescaled.print()
*/

// const print = (arr: Array<number>) => {
//   for (const r of arr) {
//     let s = '.'
//     for (let i = 0; i < r; ++i) {
//       s += 'X'
//     }
//     console.log(s)
//   }
// }

// const dur = 1000
// const tracker = new AmpTracker()
// const raw = new Array<number>()
// for (let i = 0; i < 100; ++i) {
//   const section = Math.floor(i / 20)
//   raw.push(section % 2 ? 10 : 0)
// }
// console.log('tracker +raw', raw.length)
// print(raw)
// console.log('tracker -raw')

// for (const r of raw) {
//   tracker.addAmp(r)
// }

// const after = tracker.getBucketedAmps(dur)
// console.log('tracker +after', after.length)
// print(after)
// console.log('tracker -after')
