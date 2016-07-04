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
	test(silentBenchmark{b},
		users("alice"),
		as(alice,
			custom(func(cb func(fileOp) error) error {
				err := cb(mkfile("bench", ""))
				if err != nil {
					return err
				}
				b.ResetTimer()
				for i := 0; i < b.N; i++ {
					err = cb(pwriteBS("bench", buf, (int64(i)*n)&mask))
					if err != nil {
						return err
					}
				}
				b.StopTimer()
				return nil
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
	test(silentBenchmark{b},
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
				b.ResetTimer()
				for i := 0; i < b.N; i++ {
					err = cb(preadBS("bench", buf, (int64(i)*n)&mask))
					if err != nil {
						return err
					}
				}
				b.StopTimer()
				return nil
			}),
		),
	)
}

func benchmarkWriteWithBandwith(b *testing.B, fileBytes int64,
	perWriteBytes int64, writebwKBps int) {
	buf := make([]byte, perWriteBytes)
	b.SetBytes(fileBytes)
	numWritesPerFile := int(fileBytes / perWriteBytes)
	test(silentBenchmark{b},
		users("alice"),
		blockSize(512<<10),
		bandwidth(writebwKBps),
		opTimeout(19*time.Second),
		as(alice,
			custom(func(cb func(fileOp) error) error {
				b.ResetTimer()
				for i := 0; i < b.N; i++ {
					name := fmt.Sprintf("bench%d", i)
					err := cb(mkfile(name, ""))
					if err != nil {
						return err
					}
					for j := 0; j < numWritesPerFile; j++ {
						// make each block unique
						buf[0] = byte(j + (i * numWritesPerFile))
						// Only sync after the last write
						sync := j+1 == numWritesPerFile
						err = cb(pwriteBSSync(name, buf,
							int64(j)*int64(len(buf)), sync))
						if err != nil {
							return err
						}
					}
				}
				b.StopTimer()
				return nil
			}),
		),
	)
}

func BenchmarkWriteMediumFileLowBandwidth(b *testing.B) {
	b.Skip("Doesn't work yet")
	benchmarkWriteWithBandwith(b, 1<<20 /* 1 MB */, 1<<16, 100 /* 100 KBps */)
}

func BenchmarkWriteBigFileNormalBandwidth(b *testing.B) {
	benchmarkWriteWithBandwith(b, 100<<20 /* 100 MB */, 1<<16,
		11*1024/8 /* 11 Mbps */)
}
