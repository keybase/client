package libkbfs

import (
	"io/ioutil"
	"math/rand"
	"os"
	"testing"

	"github.com/syndtr/goleveldb/leveldb"
)

func makeTestEntries(n int) ([]BlockID, []blockEntry, error) {
	ids := make([]BlockID, n)

	for i := 0; i < n; i++ {
		err := cryptoRandRead(ids[i][:])
		if err != nil {
			return nil, nil, err
		}
	}

	numEntries := 5
	entries := make([]blockEntry, numEntries)
	blockSize := 64 * 1024
	for i := 0; i < numEntries; i++ {
		entries[i].BlockData = make([]byte, blockSize)
		err := cryptoRandRead(entries[i].BlockData)
		if err != nil {
			return nil, nil, err
		}
		err = cryptoRandRead(entries[i].KeyServerHalf.ServerHalf[:])
		if err != nil {
			return nil, nil, err
		}
	}

	return ids, entries, nil
}

func doPuts(ids []BlockID, entries []blockEntry, s bserverStorage) error {
	for i := 0; i < len(ids); i++ {
		err := s.put(ids[i], entries[i%len(entries)])
		if err != nil {
			return err
		}
	}

	return nil
}

func runGetBenchmark(b *testing.B, s bserverStorage) error {
	numIDs := b.N
	if numIDs > 500 {
		numIDs = 500
	}
	ids, entries, err := makeTestEntries(numIDs)
	if err != nil {
		return err
	}

	err = doPuts(ids, entries, s)
	if err != nil {
		return err
	}

	indices := make([]int, b.N)
	for i := 0; i < b.N; i++ {
		indices[i] = rand.Intn(numIDs)
	}

	b.ResetTimer()
	defer b.StopTimer()

	for i := 0; i < b.N; i++ {
		// TODO: Do something to defeat compiler optimizations
		// if necessary.
		_, err := s.get(ids[indices[i]])
		if err != nil {
			return err
		}
	}

	return nil
}

type fileFixture struct {
	tempdir string
}

func makeFileFixture() (fixture fileFixture, err error) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "kbfs_file_storage")
	if err != nil {
		return
	}

	fixture = fileFixture{tempdir}
	return
}

func (f fileFixture) cleanup() {
	os.RemoveAll(f.tempdir)
}

type leveldbFixture struct {
	tempdir string
	db      *leveldb.DB
}

func makeLeveldbFixture() (fixture leveldbFixture, err error) {
	tempdir, err := ioutil.TempDir(os.TempDir(), "kbfs_leveldb_storage")
	if err != nil {
		return
	}

	defer func() {
		if err != nil {
			os.RemoveAll(tempdir)
		}
	}()

	db, err := leveldb.OpenFile(tempdir, leveldbOptions)
	if err != nil {
		return
	}

	fixture = leveldbFixture{tempdir, db}
	return
}

func (f leveldbFixture) cleanup() {
	f.db.Close()
	os.RemoveAll(f.tempdir)
}

func BenchmarkMemStorageGet(b *testing.B) {
	s := makeBserverMemStorage()
	err := runGetBenchmark(b, s)
	if err != nil {
		b.Fatal(err)
	}
}

func BenchmarkFileStorageGet(b *testing.B) {
	f, err := makeFileFixture()
	if err != nil {
		b.Fatal(err)
	}

	defer func() {
		f.cleanup()
	}()

	s := makeBserverFileStorage(NewCodecMsgpack(), f.tempdir)
	err = runGetBenchmark(b, s)
	if err != nil {
		b.Fatal(err)
	}
}

func BenchmarkLeveldbStorageGet(b *testing.B) {
	f, err := makeLeveldbFixture()
	if err != nil {
		b.Fatal(err)
	}

	defer func() {
		f.cleanup()
	}()

	s := makeBserverLeveldbStorage(NewCodecMsgpack(), f.db)
	err = runGetBenchmark(b, s)
	if err != nil {
		b.Fatal(err)
	}
}

func runPutBenchmark(b *testing.B, s bserverStorage) error {
	ids, entries, err := makeTestEntries(b.N)
	if err != nil {
		return err
	}

	b.ResetTimer()
	defer b.StopTimer()

	return doPuts(ids, entries, s)
}

func BenchmarkMemStoragePut(b *testing.B) {
	s := makeBserverMemStorage()
	err := runPutBenchmark(b, s)
	if err != nil {
		b.Fatal(err)
	}
}

func BenchmarkFileStoragePut(b *testing.B) {
	f, err := makeFileFixture()
	if err != nil {
		b.Fatal(err)
	}

	defer func() {
		f.cleanup()
	}()

	s := makeBserverFileStorage(NewCodecMsgpack(), f.tempdir)
	err = runPutBenchmark(b, s)
	if err != nil {
		b.Fatal(err)
	}
}

func BenchmarkLeveldbStoragePut(b *testing.B) {
	f, err := makeLeveldbFixture()
	if err != nil {
		b.Fatal(err)
	}

	defer func() {
		f.cleanup()
	}()

	s := makeBserverLeveldbStorage(NewCodecMsgpack(), f.db)
	err = runPutBenchmark(b, s)
	if err != nil {
		b.Fatal(err)
	}
}
