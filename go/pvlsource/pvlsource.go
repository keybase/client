// Copyright 2017 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package pvlsource

import (
	"crypto/sha512"
	"encoding/hex"
	"fmt"
	"io/ioutil"
	"sync"
	"time"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-codec/codec"
	jsonw "github.com/keybase/go-jsonw"
)

// Older than this will try to refresh merkle root.
// Measures time since merkle root fetched, not time since published.
const tShouldRefresh time.Duration = 1 * time.Hour

// Older than this is too old to use. All identifies will fail.
// Measures time since merkle root fetched, not time since published.
const tRequireRefresh time.Duration = 24 * time.Hour

var dbKey = libkb.DbKey{
	Typ: libkb.DBPvl,
	Key: "active",
}

// Bump this to ignore existing cache entries.
const dbVersion = 1

type entry struct {
	dbVersion int
	hash      string
	pvl       string
}

// PvlSource is the way to get active pvl.
// Talks to MerkleClient
// Has an in-memory and LocalDB cache.
type PvlSourceImpl struct {
	libkb.Contextified
	sync.Mutex

	mem *entry
}

var _ libkb.PvlSource = (*PvlSourceImpl)(nil)

// NewPvlSource creates a new source and installs it into G.
func NewPvlSourceAndInstall(g *libkb.GlobalContext) libkb.PvlSource {
	s := &PvlSourceImpl{
		Contextified: libkb.NewContextified(g),
	}
	g.SetPvlSource(s)
	return s
}

// Get PVL to use.
func (s *PvlSourceImpl) GetPVL(ctx context.Context, pvlVersion int) (string, error) {
	kitJSON, err := s.GetKitString(ctx)
	if err != nil {
		return "", err
	}
	kit, err := jsonw.Unmarshal([]byte(kitJSON))
	if err != nil {
		return "", err
	}

	sub := kit.AtKey("tab").AtKey(fmt.Sprintf("%d", pvlVersion))
	if !sub.IsOk() {
		return "", fmt.Errorf("missing pvl for version: %d", pvlVersion)
	}
	if sub.IsNil() {
		return "", fmt.Errorf("empty pvl for version: %d", pvlVersion)
	}
	pvl, err := sub.Marshal()
	if err != nil {
		return "", fmt.Errorf("error re-marshalling pvl: %s", err)
	}
	return string(pvl), nil
}

// Get pvl kit as a string.
// First it makes sure that the merkle root is recent enough.
// Using the pvl hash from that, it fetches from in-memory falling back to db
// falling back to server.
func (s *PvlSourceImpl) GetKitString(ctx context.Context) (string, error) {

	// Use a file instead if specified.
	if len(s.G().Env.GetPvlKitFilename()) > 0 {
		return s.readFile(s.G().Env.GetPvlKitFilename())
	}

	mc := s.G().GetMerkleClient()
	if mc == nil {
		return "", fmt.Errorf("no MerkleClient available")
	}

	root := mc.LastRoot()
	// The time that the root was fetched is used rather than when the
	// root was published so that we can continue to operate even if
	// the root has not been published in a long time.
	if (root == nil) || s.pastDue(root.Fetched(), tShouldRefresh) {
		s.G().Log.Debug("PvlSource: merkle root should refresh")

		// Attempt a refresh if the root is old or nil.
		err := s.refreshRoot(ctx)
		if err != nil {
			s.G().Log.Warning("could not refresh merkle root: %s", err)
		} else {
			root = mc.LastRoot()
		}
	}

	if root == nil {
		return "", fmt.Errorf("no merkle root")
	}

	if s.pastDue(root.Fetched(), tRequireRefresh) {
		// The root is still too old, even after an attempted refresh.
		s.G().Log.Debug("PvlSource: merkle root too old")
		return "", fmt.Errorf("merkle root too old: %v %s", seqnoWrap(root.Seqno()), root.Fetched())
	}

	// This is the hash we are being instructed to use.
	hash := root.PvlHash()

	if hash == "" {
		return "", fmt.Errorf("merkle root has empty pvl hash: %v", seqnoWrap(root.Seqno()))
	}

	// If multiple Get's occur, these mem/db gets and sets may race.
	// But it shouldn't affect correctness, worst that could happen is an old write and/or cache miss.
	// And pvl updates so infrequently it's very unlikely to have multiple outstanding writes.

	// Use in-memory cache if it matches
	fromMem := s.memGet(hash)
	if fromMem != nil {
		return *fromMem, nil
	}

	// Use db cache if it matches
	fromDB := s.dbGet(hash)
	if fromDB != nil {
		return *fromDB, nil
	}

	// Fetch from the server
	// This validates the hash
	pvl, err := s.fetch(ctx, hash)
	if err != nil {
		return "", err
	}

	// Store to memory
	s.memSet(hash, pvl)

	// Schedule a db write
	go s.dbSet(hash, pvl)

	return pvl, nil
}

// Fetch pvl and check the hash.
func (s *PvlSourceImpl) fetch(ctx context.Context, hash string) (string, error) {
	res, err := s.G().API.Get(libkb.APIArg{
		Endpoint:    "merkle/pvl",
		NeedSession: false,
		NetContext:  ctx,
		Args: libkb.HTTPArgs{
			"hash": libkb.S{Val: hash},
		},
	})
	if err != nil {
		return "", err
	}
	kitJSON, err := res.Body.AtPath("kit_json").GetString()
	if err != nil {
		return "", err
	}
	if kitJSON == "" {
		return "", fmt.Errorf("server returned empty pvl")
	}
	if s.hash(kitJSON) != hash {
		s.G().Log.Warning("pvl hash mismatch: got:%s expected:%s", s.hash(kitJSON), hash)
		return "", fmt.Errorf("server returned wrong pvl")
	}
	return kitJSON, nil
}

// updateRoot kicks MerkleClient to update its merkle root
// by doing a LookupUser on some arbitrary user.
func (s *PvlSourceImpl) refreshRoot(ctx context.Context) error {
	q := libkb.NewHTTPArgs()
	// The user lookup here is unecessary. It is done because that is what
	// is easy with MerkleClient.
	// The user lookuped up is you if known, otherwise arbitrarily t_alice.
	// If t_alice is removed, this path will break.
	uid := s.G().GetMyUID()
	if len(uid) == 0 {
		// Use t_alice's uid.
		uid = keybase1.UID("295a7eea607af32040647123732bc819")
	}
	q.Add("uid", libkb.UIDArg(uid))
	_, err := s.G().MerkleClient.LookupUser(ctx, q, nil)
	return err
}

func (s *PvlSourceImpl) memGet(hash string) *string {
	s.Lock()
	defer s.Unlock()
	if s.mem != nil {
		if s.mem.hash == hash {
			ret := s.mem.pvl
			return &ret
		}
	}
	return nil
}

func (s *PvlSourceImpl) memSet(hash string, pvl string) {
	s.Lock()
	defer s.Unlock()
	s.mem = &entry{
		dbVersion: dbVersion,
		hash:      hash,
		pvl:       pvl,
	}
}

// Get from local db. Can return nil.
func (s *PvlSourceImpl) dbGet(hash string) *string {
	db := s.G().LocalDb
	if db == nil {
		return nil
	}
	buf, found, err := db.GetRaw(dbKey)
	if err != nil {
		s.G().Log.Warning("error reading from db: %s", err)
		return nil
	}
	if !found {
		return nil
	}
	var e entry
	err = decode(buf, &e)
	if err != nil {
		s.G().Log.Warning("error reading db: %s", err)
		return nil
	}
	if e.dbVersion != e.dbVersion {
		return nil
	}
	if e.hash == hash {
		return &e.pvl
	}
	return nil
}

// Run in a goroutine.
// Logs errors.
func (s *PvlSourceImpl) dbSet(hash string, pvl string) {
	db := s.G().LocalDb
	if db == nil {
		s.G().Log.Error("storing pvl: no db")
	}
	buf, err := encode(entry{
		dbVersion: dbVersion,
		hash:      hash,
		pvl:       pvl,
	})
	if err != nil {
		s.G().Log.Error("storing pvl: %s", err)
	}
	err = db.PutRaw(dbKey, buf)
	if err != nil {
		s.G().Log.Error("storing pvl: %s", err)
	}
}

// hex of sha512
func (s *PvlSourceImpl) hash(in string) string {
	buf := sha512.Sum512([]byte(in))
	out := hex.EncodeToString(buf[:])
	return out
}

func (s *PvlSourceImpl) pastDue(event time.Time, limit time.Duration) bool {
	diff := s.G().Clock().Now().Sub(event)
	return diff > limit
}

func (s *PvlSourceImpl) readFile(path string) (string, error) {
	buf, err := ioutil.ReadFile(path)
	return string(buf), err
}

func encode(input interface{}) ([]byte, error) {
	mh := codec.MsgpackHandle{WriteExt: true}
	var data []byte
	enc := codec.NewEncoderBytes(&data, &mh)
	if err := enc.Encode(input); err != nil {
		return nil, err
	}
	return data, nil
}

func decode(data []byte, res interface{}) error {
	mh := codec.MsgpackHandle{WriteExt: true}
	dec := codec.NewDecoderBytes(data, &mh)
	err := dec.Decode(res)
	return err
}

func seqnoWrap(x *libkb.Seqno) int64 {
	if x == nil {
		return 0
	}
	return int64(*x)
}
