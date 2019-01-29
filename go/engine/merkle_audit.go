// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// MerkleAudit runs a merkle tree audit in the background once in a while.
// It verifies the skips of a randomly chosen merkle tree root, making
// sure that the server is not tampering with the merkle trees.

package engine

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"sync"
	"time"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

var (
	errAuditOffline    = errors.New("Merkle audit failed to run due to the lack of connectivity.")
	errAuditNoLastRoot = errors.New("Merkle audit failed to run due to not being able to get the last root.")
)

var MerkleAuditSettings = BackgroundTaskSettings{
	Start:            5 * time.Minute,
	StartStagger:     1 * time.Hour,
	Interval:         6 * time.Hour,
	Limit:            1 * time.Minute,
	DisableInBotLite: true,
}

// MerkleAudit is an engine.
type MerkleAudit struct {
	libkb.Contextified
	sync.Mutex

	args *MerkleAuditArgs
	task *BackgroundTask
}

type MerkleAuditArgs struct {
	// Channels used for testing. Normally nil.
	testingMetaCh     chan<- string
	testingRoundResCh chan<- error
}

type merkleAuditState struct {
	RetrySeqno *keybase1.Seqno `json:"retrySeqno"`
}

// NewMerkleAudit creates a new MerkleAudit engine.
func NewMerkleAudit(g *libkb.GlobalContext, args *MerkleAuditArgs) *MerkleAudit {
	task := NewBackgroundTask(g, &BackgroundTaskArgs{
		Name:     "MerkleAudit",
		F:        MerkleAuditRound,
		Settings: MerkleAuditSettings,

		testingMetaCh:     args.testingMetaCh,
		testingRoundResCh: args.testingRoundResCh,
	})
	return &MerkleAudit{
		Contextified: libkb.NewContextified(g),
		args:         args,
		task:         task,
	}
}

// Name is the unique engine name.
func (e *MerkleAudit) Name() string {
	return "MerkleAudit"
}

// GetPrereqs returns the engine prereqs.
func (e *MerkleAudit) Prereqs() Prereqs {
	return Prereqs{}
}

// RequiredUIs returns the required UIs.
func (e *MerkleAudit) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *MerkleAudit) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{}
}

// Run starts the engine.
// Returns immediately, kicks off a background goroutine.
func (e *MerkleAudit) Run(m libkb.MetaContext) (err error) {
	return RunEngine2(m, e.task)
}

func (e *MerkleAudit) Shutdown() {
	e.task.Shutdown()
}

// randSeqno picks a random number between [low, high).
func randSeqno(lo keybase1.Seqno, hi keybase1.Seqno) (keybase1.Seqno, error) {
	rangeBig := big.NewInt(int64(hi - lo))
	n, err := rand.Int(rand.Reader, rangeBig)
	if err != nil {
		return keybase1.Seqno(0), err
	}
	return keybase1.Seqno(n.Int64()) + lo, nil
}

var merkleAuditKey = libkb.DbKey{
	Typ: libkb.DBMerkleAudit,
	Key: "root",
}

func lookupMerkleAuditRetryFromState(m libkb.MetaContext) (*keybase1.Seqno, error) {
	var state merkleAuditState
	found, err := m.G().LocalDb.GetInto(&state, merkleAuditKey)
	if err != nil {
		return nil, err
	}
	if !found {
		// Nothing found, no error
		return nil, nil
	}

	// Can still be nil
	return state.RetrySeqno, nil
}

func saveMerkleAuditState(m libkb.MetaContext, state merkleAuditState) error {
	return m.G().LocalDb.PutObj(merkleAuditKey, nil, state)
}

func performMerkleAudit(m libkb.MetaContext, startSeqno keybase1.Seqno) error {
	if m.G().ConnectivityMonitor.IsConnected(m.Ctx()) == libkb.ConnectivityMonitorNo {
		m.CDebugf("MerkleAudit giving up offline")
		return errAuditOffline
	}

	// Acquire the most recent merkle tree root
	lastRoot := m.G().MerkleClient.LastRoot()
	if lastRoot == nil {
		m.CDebugf("MerkleAudit unable to retrieve the last root")
		return errAuditNoLastRoot
	}

	// We can copy the pointer's value as it can only return nil if root == nil.
	lastSeqno := *lastRoot.Seqno()

	// Acquire the first root and calculate its hash
	startRoot, err := m.G().MerkleClient.LookupRootAtSeqno(m, startSeqno)
	if err != nil {
		return err
	}
	startHash := startRoot.ShortHash()

	// Traverse the merkle tree seqnos
	currentSeqno := startSeqno + 1
	step := 1
	for {
		// Proceed until the last known root
		if currentSeqno > lastSeqno {
			break
		}

		currentRoot, err := m.G().MerkleClient.LookupRootAtSeqno(m, currentSeqno)
		if err != nil {
			return err
		}
		currentHash := currentRoot.SkipToSeqno(startSeqno)
		if currentHash == nil {
			return libkb.NewClientMerkleSkipMissingError(
				fmt.Sprintf("Root %d missing skip hash to %d", currentSeqno, startSeqno),
			)
		}

		if !startHash.Eq(currentHash) {
			// Warn the user about the possibility of the server tampering with the roots.
			return libkb.NewClientMerkleSkipHashMismatchError(
				fmt.Sprintf("Invalid skip hash from %d to %d", currentSeqno, startSeqno),
			)
		}

		// We're doing this exponentially to make use of the skips.
		currentSeqno += keybase1.Seqno(step)
		step *= 2
	}

	return nil
}

func MerkleAuditRound(m libkb.MetaContext) (err error) {
	m = m.WithLogTag("MAUDT")
	defer m.CTraceTimed("MerkleAuditRound", func() error { return err })()

	// Look up any previously requested retries
	startSeqno, err := lookupMerkleAuditRetryFromState(m)
	if err != nil {
		m.CDebugf("MerkleAudit unable to acquire saved state from localdb")
		return nil
	}

	// If no retry was requested
	if startSeqno == nil {
		// nil seqno, generate a new one:
		// 1. Acquire the most recent merkle tree root
		lastRoot := m.G().MerkleClient.LastRoot()
		if lastRoot == nil {
			m.CDebugf("MerkleAudit unable to retrieve the last root")
			return nil
		}
		lastSeqno := *lastRoot.Seqno()

		// 2. Figure out the first merkle root seqno with skips, fall back to 1
		firstSeqno := m.G().MerkleClient.FirstSeqnoWithSkips(m)
		if firstSeqno == nil {
			val := keybase1.Seqno(1)
			firstSeqno = &val
		}

		// 3. Generate a random seqno for the starting root in the audit.
		randomSeqno, err := randSeqno(*firstSeqno, lastSeqno)
		if err != nil {
			return err
		}

		startSeqno = &randomSeqno
	}

	// If this time it fails, save it
	err = performMerkleAudit(m, *startSeqno)
	if err == nil {
		// Early return for fewer ifs
		return saveMerkleAuditState(m, merkleAuditState{
			RetrySeqno: nil,
		})
	}

	// All MerkleClientErrors would suggest that the server is tampering with the roots
	if _, ok := err.(libkb.MerkleClientError); ok {
		m.CErrorf("MerkleAudit fatally failed: %s", err)
	} else {
		m.CDebugf("MerkleAudit could not complete: %s", err)
	}

	// Use another error variable to prevent shadowing
	if serr := saveMerkleAuditState(m, merkleAuditState{
		RetrySeqno: startSeqno,
	}); serr != nil {
		return serr
	}

	return err
}
