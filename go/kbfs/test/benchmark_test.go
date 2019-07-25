// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

// These benchmarks can be run with:
// go test -test.bench=. -benchmem
// go test -test.bench=. -benchmem -tags fuse
// go test -test.bench=. -benchmem -tags dokan

package test

import (
	"fmt"
	"testing"
	"time"

	"github.com/keybase/client/go/kbfs/data"
)

// BenchmarkWriteSeq512 writes to a large file in 512 byte writes.
func BenchmarkWriteSeq512(b *testing.B) {
	benchmarkWriteSeqN(b, 512, 0xFFFFFFFFFFFF)
}
func BenchmarkWriteSeq4k(b *testing.B) {
	benchmarkWriteSeqN(b, 4*1024, 0xFFFFFFFFFFFF)
}
func BenchmarkWriteSeq64k(b *testing.B) {
	benchmarkWriteSeqN(b, 64*1024, 0xFFFFFFFFFFFF)
}
func BenchmarkWriteSeq512k(b *testing.B) {
	benchmarkWriteSeqN(b, 512*1024, 0xFFFFFFFFFFFF)
}

// BenchmarkWrite1mb512 writes to a 1mb file in 512 byte writes.
func BenchmarkWrite1mb512(b *testing.B) {
	benchmarkWriteSeqN(b, 512, 0xFFFFF)
}
func BenchmarkWrite1mb4k(b *testing.B) {
	benchmarkWriteSeqN(b, 4*1024, 0xFFFFF)
}
func BenchmarkWrite1mb64k(b *testing.B) {
	benchmarkWriteSeqN(b, 64*1024, 0xFFFFF)
}
func BenchmarkWrite1mb512k(b *testing.B) {
	benchmarkWriteSeqN(b, 512*1024, 0xFFFFF)
}

func benchmarkWriteSeqN(b *testing.B, n int64, mask int64) {
	buf := make([]byte, n)
	b.SetBytes(n)
	benchmark(b,
		users("alice"),
		as(alice,
			custom(func(cb func(fileOp) error) error {
				err := cb(mkfile("bench", ""))
				if err != nil {
					return err
				}
				var n int
				err = cb(getBenchN(&n))
				if err != nil {
					return err
				}
				err = cb(resetTimer())
				if err != nil {
					return err
				}
				for i := 0; i < n; i++ {
					err = cb(pwriteBS("bench", buf, (int64(i*n))&mask))
					if err != nil {
						return err
					}
				}
				return cb(stopTimer())
			}),
		),
	)
}

// BenchmarkReadHoleSeq512 reads from a large file in 512 byte reads.
func BenchmarkReadHoleSeq512(b *testing.B) {
	benchmarkReadSeqHoleN(b, 512, 0xFFFFFFF)
}
func BenchmarkReadHoleSeq4k(b *testing.B) {
	benchmarkReadSeqHoleN(b, 4*1024, 0xFFFFFFF)
}
func BenchmarkReadHoleSeq64k(b *testing.B) {
	benchmarkReadSeqHoleN(b, 64*1024, 0xFFFFFFF)
}
func BenchmarkReadHoleSeq512k(b *testing.B) {
	benchmarkReadSeqHoleN(b, 512*1024, 0xFFFFFFF)
}

// BenchmarkReadHole1mb512 reads from a 1mb file in 512 byte reads.
func BenchmarkReadHole1mb512(b *testing.B) {
	benchmarkReadSeqHoleN(b, 512, 0xFFFFF)
}
func BenchmarkReadHole1mb4k(b *testing.B) {
	benchmarkReadSeqHoleN(b, 4*1024, 0xFFFFF)
}
func BenchmarkReadHole1mb64k(b *testing.B) {
	benchmarkReadSeqHoleN(b, 64*1024, 0xFFFFF)
}
func BenchmarkReadHole1mb512k(b *testing.B) {
	benchmarkReadSeqHoleN(b, 512*1024, 0xFFFFF)
}

func benchmarkReadSeqHoleN(b *testing.B, n int64, mask int64) {
	buf := make([]byte, n)
	b.SetBytes(n)
	benchmark(b,
		users("alice"),
		as(alice,
			custom(func(cb func(fileOp) error) error {
				err := cb(mkfile("bench", ""))
				if err != nil {
					return err
				}
				err = cb(truncate("bench", uint64(mask+1)))
				if err != nil {
					return err
				}
				var n int
				err = cb(getBenchN(&n))
				if err != nil {
					return err
				}
				err = cb(resetTimer())
				if err != nil {
					return err
				}
				for i := 0; i < n; i++ {
					err = cb(preadBS("bench", buf, (int64(i*n))&mask))
					if err != nil {
						return err
					}
				}
				return cb(stopTimer())
			}),
		),
	)
}

func benchmarkDoBenchWrites(b *testing.B, cb func(fileOp) error,
	numWritesPerFile int, buf []byte, startIter int) error {
	var n int
	err := cb(getBenchN(&n))
	if err != nil {
		return err
	}
	for i := startIter; i < n+startIter; i++ {
		name := fmt.Sprintf("bench%d", i)
		err := cb(mkfile(name, ""))
		if err != nil {
			return err
		}
		for j := 0; j < numWritesPerFile; j++ {
			// make each block unique
			for k := 0; k < 1+len(buf)/data.MaxBlockSizeBytesDefault; k++ {
				buf[k] = byte(i)
				buf[k+1] = byte(j)
				buf[k+2] = byte(k)
			}
			// Only sync after the last write
			sync := j+1 == numWritesPerFile
			err = cb(pwriteBSSync(name, buf,
				int64(j)*int64(len(buf)), sync))
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func benchmarkWriteWithBandwidthHelper(b *testing.B, fileBytes int64,
	perWriteBytes int64, writebwKBps int, doWarmUp bool) {
	buf := make([]byte, perWriteBytes)
	b.SetBytes(fileBytes)
	numWritesPerFile := int(fileBytes / perWriteBytes)
	benchmark(b,
		users("alice"),
		blockSize(512<<10),
		bandwidth(writebwKBps),
		opTimeout(19*time.Second),
		as(alice,
			custom(func(cb func(fileOp) error) (err error) {
				startIter := 0
				var n int
				err = cb(getBenchN(&n))
				if err != nil {
					return err
				}
				if doWarmUp {
					if err := benchmarkDoBenchWrites(b, cb,
						numWritesPerFile, buf, 0); err != nil {
						return err
					}
					startIter = n
				}
				err = cb(resetTimer())
				if err != nil {
					return err
				}
				defer func() {
					stopErr := cb(stopTimer())
					if err == nil && stopErr != nil {
						err = stopErr
					}
				}()
				return benchmarkDoBenchWrites(b, cb, numWritesPerFile, buf,
					startIter)
			}),
		),
	)
}

func benchmarkWriteWithBandwidthPlusWarmup(b *testing.B, fileBytes int64,
	perWriteBytes int64, writebwKBps int) {
	benchmarkWriteWithBandwidthHelper(b, fileBytes, perWriteBytes,
		writebwKBps, true)
}

func benchmarkWriteWithBandwidth(b *testing.B, fileBytes int64,
	perWriteBytes int64, writebwKBps int) {
	benchmarkWriteWithBandwidthHelper(b, fileBytes, perWriteBytes,
		writebwKBps, false)
}

func BenchmarkWriteMediumFileLowBandwidth(b *testing.B) {
	benchmarkWriteWithBandwidth(b, 10<<20 /* 10 MB */, 1<<16, /* 65 KB writes */
		100 /* 100 KBps */)
}

func BenchmarkWriteBigFileNormalBandwidth(b *testing.B) {
	// Warm up to get the buffer as large as possible
	benchmarkWriteWithBandwidthPlusWarmup(b, 100<<20, /* 100 MB */
		1<<16 /* 65 KB writes */, 11*1024/8 /* 11 Mbps */)
}

func BenchmarkWriteBigFileBigBandwidth(b *testing.B) {
	// Warm up to get the buffer as large as possible
	benchmarkWriteWithBandwidthPlusWarmup(b, 1<<30, /* 1 GB */
		1<<20 /*1 MB writes */, 100*1024/8 /* 100 Mbps */)
}

func BenchmarkWriteMixedFilesNormalBandwidth(b *testing.B) {
	perWriteBytes := int64(1 << 16) // 65 KB writes
	buf := make([]byte, perWriteBytes)

	// Files:
	// * 100 MB to set the buffer size appropriately
	// * A bunch of 2 MB files
	// * Another 100 MB to make sure the buffer is still sized right
	fileSizes := []int64{100 << 20}
	for i := 0; i < 50; i++ {
		fileSizes = append(fileSizes, 2<<20)
	}
	fileSizes = append(fileSizes, 100<<20)
	var totalSize int64
	for _, size := range fileSizes {
		totalSize += size
	}
	b.SetBytes(totalSize)

	benchmark(b,
		users("alice"),
		blockSize(512<<10),
		bandwidth(11*1024/8 /* 11 Mbps */),
		opTimeout(19*time.Second),
		as(alice,
			custom(func(cb func(fileOp) error) (err error) {
				var n int
				err = cb(getBenchN(&n))
				if err != nil {
					return err
				}
				err = cb(resetTimer())
				if err != nil {
					return err
				}
				defer func() {
					stopErr := cb(stopTimer())
					if err == nil && stopErr != nil {
						err = stopErr
					}
				}()
				currIter := 0
				for _, fileSize := range fileSizes {
					numWrites := int(fileSize / perWriteBytes)
					if err := benchmarkDoBenchWrites(b, cb,
						numWrites, buf, currIter); err != nil {
						return err
					}
					currIter += n
				}
				return nil
			}),
		),
	)
}

func benchmarkMultiFileSync(
	b *testing.B, numFiles, fileSize int, timeWrites, timeFlush bool) {
	isolateStages := !timeWrites || !timeFlush
	benchmark(b,
		journal(),
		users("alice"),
		batchSize(20),
		as(alice,
			mkdir("a"),
		),
		as(alice,
			enableJournal(),
			custom(func(cb func(fileOp) error) (err error) {
				if isolateStages {
					// If we want to time one of the stages
					// separately, pause the journal.
					err = cb(pauseJournal())
					if err != nil {
						return err
					}
				}

				var n int
				err = cb(getBenchN(&n))
				if err != nil {
					return err
				}
				buf := make([]byte, numFiles*fileSize+fileSize)
				for i := 0; i < numFiles*fileSize; i++ {
					// Make sure we mix up the byte values a bit, so
					// we don't accidentally trigger any deduplication.
					buf[i] = byte(i)
				}
				err = cb(resetTimer())
				if err != nil {
					return err
				}
				defer func() {
					stopErr := cb(stopTimer())
					if err == nil && stopErr != nil {
						err = stopErr
					}
				}()
				for iter := 0; iter < n; iter++ {
					if !timeWrites {
						err = cb(stopTimer())
						if err != nil {
							return err
						}
					}
					// Write to each file without syncing.
					for i := iter * numFiles; i < (iter+1)*numFiles; i++ {
						f := fmt.Sprintf("a/b/c/file%d", i)
						start := (i%numFiles)*fileSize + (iter % fileSize)
						err := cb(pwriteBSSync(
							f, buf[start:start+fileSize], 0, false))
						if err != nil {
							return err
						}
					}
					// Sync each file by doing a no-op truncate.
					for i := iter * numFiles; i < (iter+1)*numFiles; i++ {
						f := fmt.Sprintf("a/b/c/file%d", i)
						err := cb(truncate(f, uint64(fileSize)))
						if err != nil {
							return err
						}
					}
					if !timeWrites {
						err = cb(startTimer())
						if err != nil {
							return err
						}
					}
					if !timeFlush {
						err = cb(stopTimer())
						if err != nil {
							return err
						}
					}
					if isolateStages {
						err = cb(resumeJournal())
						if err != nil {
							return err
						}
					}
					err = cb(flushJournal())
					if err != nil {
						return err
					}
					if isolateStages {
						err = cb(pauseJournal())
						if err != nil {
							return err
						}
					}
					if !timeFlush {
						err = cb(startTimer())
						if err != nil {
							return err
						}
					}
				}
				return nil
			}),
		),
	)
}

func BenchmarkMultiFileSync(b *testing.B) {
	benchmarkMultiFileSync(b, 20, 5, true, false)
}

func BenchmarkMultiFileSyncLargeWrites(b *testing.B) {
	benchmarkMultiFileSync(b, 1000, 5, true, false)
}

func BenchmarkMultiFileSyncLargeFlush(b *testing.B) {
	benchmarkMultiFileSync(b, 1000, 5, false, true)
}

func BenchmarkMultiFileSyncLarge(b *testing.B) {
	benchmarkMultiFileSync(b, 1000, 5, true, true)
}

func BenchmarkMultiFileSyncBigFilesWrites(b *testing.B) {
	benchmarkMultiFileSync(b, 5, 1*1024*1024, true, false)
}

func BenchmarkMultiFileSyncBigFilesFlush(b *testing.B) {
	benchmarkMultiFileSync(b, 5, 1*1024*1024, false, true)
}

func BenchmarkMultiFileSyncBigFiles(b *testing.B) {
	benchmarkMultiFileSync(b, 5, 1*1024*1024, true, true)
}
