package idxfile

import (
	"crypto/sha1"
	"hash"
	"io"

	"gopkg.in/src-d/go-git.v4/plumbing"
	"gopkg.in/src-d/go-git.v4/utils/binary"
)

// Encoder writes MemoryIndex structs to an output stream.
type Encoder struct {
	io.Writer
	hash hash.Hash
}

// NewEncoder returns a new stream encoder that writes to w.
func NewEncoder(w io.Writer) *Encoder {
	h := sha1.New()
	mw := io.MultiWriter(w, h)
	return &Encoder{mw, h}
}

// Encode encodes an MemoryIndex to the encoder writer.
func (e *Encoder) Encode(idx *MemoryIndex, statusChan plumbing.StatusChan) (int, error) {
	flow := []func(*MemoryIndex, plumbing.StatusChan) (int, error){
		e.encodeHeader,
		e.encodeFanout,
		e.encodeHashes,
		e.encodeCRC32,
		e.encodeOffsets,
		e.encodeChecksums,
	}

	sz := 0
	for _, f := range flow {
		i, err := f(idx, statusChan)
		sz += i

		if err != nil {
			return sz, err
		}
	}

	return sz, nil
}

func (e *Encoder) encodeHeader(idx *MemoryIndex, _ plumbing.StatusChan) (int, error) {
	c, err := e.Write(idxHeader)
	if err != nil {
		return c, err
	}

	return c + 4, binary.WriteUint32(e, idx.Version)
}

func (e *Encoder) encodeFanout(idx *MemoryIndex, _ plumbing.StatusChan) (int, error) {
	for _, c := range idx.Fanout {
		if err := binary.WriteUint32(e, c); err != nil {
			return 0, err
		}
	}

	return fanout * 4, nil
}

func (e *Encoder) encodeHashes(idx *MemoryIndex, statusChan plumbing.StatusChan) (int, error) {
	update := plumbing.StatusUpdate{
		Stage:        plumbing.StatusIndexHash,
		ObjectsTotal: idx.count(),
	}
	statusChan.SendUpdate(update)

	var size int
	for k := 0; k < fanout; k++ {
		pos := idx.FanoutMapping[k]
		if pos == noMapping {
			continue
		}
		n, err := e.Write(idx.Names[pos])
		if err != nil {
			return size, err
		}
		size += n
		update.ObjectsDone++
		statusChan.SendUpdateIfPossible(update)
	}
	return size, nil
}

func (e *Encoder) encodeCRC32(idx *MemoryIndex, statusChan plumbing.StatusChan) (int, error) {
	update := plumbing.StatusUpdate{
		Stage:        plumbing.StatusIndexCRC,
		ObjectsTotal: idx.count(),
	}
	statusChan.SendUpdate(update)

	var size int
	for k := 0; k < fanout; k++ {
		pos := idx.FanoutMapping[k]
		if pos == noMapping {
			continue
		}

		n, err := e.Write(idx.CRC32[pos])
		if err != nil {
			return size, err
		}

		size += n
		update.ObjectsDone++
		statusChan.SendUpdateIfPossible(update)
	}

	return size, nil
}

func (e *Encoder) encodeOffsets(idx *MemoryIndex, statusChan plumbing.StatusChan) (int, error) {
	update := plumbing.StatusUpdate{
		Stage:        plumbing.StatusIndexOffset,
		ObjectsTotal: idx.count(),
	}
	statusChan.SendUpdate(update)

	var size int
	for k := 0; k < fanout; k++ {
		pos := idx.FanoutMapping[k]
		if pos == noMapping {
			continue
		}

		n, err := e.Write(idx.Offset32[pos])
		if err != nil {
			return size, err
		}

		size += n
		update.ObjectsDone++
		statusChan.SendUpdateIfPossible(update)
	}

	if len(idx.Offset64) > 0 {
		n, err := e.Write(idx.Offset64)
		if err != nil {
			return size, err
		}

		size += n
	}

	return size, nil
}

func (e *Encoder) encodeChecksums(idx *MemoryIndex, _ plumbing.StatusChan) (int, error) {
	if _, err := e.Write(idx.PackfileChecksum[:]); err != nil {
		return 0, err
	}

	copy(idx.IdxChecksum[:], e.hash.Sum(nil)[:20])
	if _, err := e.Write(idx.IdxChecksum[:]); err != nil {
		return 0, err
	}

	return 40, nil
}
