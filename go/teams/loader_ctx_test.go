package teams

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/davecgh/go-spew/spew"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
	"github.com/stretchr/testify/require"
)

type MockLoaderContext struct {
	t               *testing.T
	unit            TestCase
	defaultTeamName keybase1.TeamName
	state           MockLoaderContextState
}

var _ LoaderContext = (*MockLoaderContext)(nil)

type MockLoaderContextState struct {
	loadSpec TestCaseLoad
}

func NewMockLoaderContext(t *testing.T, g *libkb.GlobalContext, unit TestCase) *MockLoaderContext {
	defaultTeamName, err := keybase1.TeamNameFromString("cabal")
	require.NoError(t, err)
	return &MockLoaderContext{
		t:               t,
		unit:            unit,
		defaultTeamName: defaultTeamName,
	}
}

func (l *MockLoaderContext) getNewLinksFromServer(ctx context.Context,
	teamID keybase1.TeamID, lows getLinksLows,
	readSubteamID *keybase1.TeamID) (*rawTeam, error) {

	return l.getLinksFromServerHelper(ctx, teamID, lows, nil, readSubteamID)
}

func (l *MockLoaderContext) getLinksFromServer(ctx context.Context,
	teamID keybase1.TeamID, requestSeqnos []keybase1.Seqno, readSubteamID *keybase1.TeamID) (*rawTeam, error) {

	return l.getLinksFromServerHelper(ctx, teamID, getLinksLows{}, requestSeqnos, readSubteamID)
}

func (l *MockLoaderContext) getLinksFromServerHelper(ctx context.Context,
	teamID keybase1.TeamID, lows getLinksLows,
	requestSeqnos []keybase1.Seqno, readSubteamID *keybase1.TeamID) (*rawTeam, error) {

	_ = readSubteamID // Allow all access.

	name := l.defaultTeamName

	teamSpec, ok := l.unit.Teams[name.String()]
	if !ok {
		return nil, NewMockBoundsError("getLinksFromServer", "name", name.String())
	}

	var links []json.RawMessage
	var latestLinkToSend keybase1.Seqno
	for _, link := range teamSpec.Links {
		// Stub out those links in teamSpec that claim seqnos
		// that are in the Unit.Load.Stub list.
		linkJ, err := jsonw.Unmarshal(link)
		require.NoError(l.t, err)
		seqno, err := linkJ.AtKey("seqno").GetInt()
		require.NoError(l.t, err)
		var stub bool
		var omit bool
		for _, stubSeqno := range l.state.loadSpec.Stub {
			// Stub if in stub list
			if stubSeqno == keybase1.Seqno(seqno) {
				stub = true
			}
		}
		for _, omitSeqno := range l.state.loadSpec.Omit {
			// Omit if in omit list
			if omitSeqno == keybase1.Seqno(seqno) {
				omit = true
			}
		}
		if l.state.loadSpec.Upto > keybase1.Seqno(0) && keybase1.Seqno(seqno) > l.state.loadSpec.Upto {
			// Omit if Upto blocks it
			omit = true
		}
		if lows.Seqno >= keybase1.Seqno(seqno) && len(requestSeqnos) == 0 {
			// Omit if the client already has it, only if requestSeqnos is not set.
			omit = true
		}
		if omit {
			// pass
		} else if stub {
			l.t.Logf("MockLoaderContext stubbing link seqno: %v", seqno)
			err := linkJ.DeleteKey("payload_json")
			require.NoError(l.t, err)
			stubbed, err := linkJ.Marshal()
			require.NoError(l.t, err)
			links = append(links, stubbed)
		} else {
			links = append(links, link)
		}
		if !omit {
			latestLinkToSend = keybase1.Seqno(seqno)
		}
	}

	l.t.Logf("loadSpec: %v", spew.Sdump(l.state.loadSpec))

	var box *TeamBox
	prevs := make(map[keybase1.PerTeamKeyGeneration]prevKeySealedEncoded)
	require.NotEqual(l.t, len(teamSpec.TeamKeyBoxes), 0, "need some team key boxes")
	for _, boxSpec := range teamSpec.TeamKeyBoxes {
		require.NotEqual(l.t, 0, boxSpec.Seqno, "bad box seqno")
		if boxSpec.Seqno <= latestLinkToSend || l.state.loadSpec.ForceLastBox {
			box2 := boxSpec.TeamBox
			box = &box2

			if boxSpec.Prev != nil {
				omitPrevs := int(l.state.loadSpec.OmitPrevs)
				if !(omitPrevs > 0 && int(boxSpec.TeamBox.Generation)-1 <= omitPrevs) {
					prevs[boxSpec.TeamBox.Generation] = *boxSpec.Prev
				}
			}
		}
	}
	if l.state.loadSpec.OmitBox {
		box = nil
	}

	l.t.Logf("returning %v links (latest %v)", len(links), latestLinkToSend)
	if box != nil {
		l.t.Logf("returning box generation:%v (%v prevs)", box.Generation, len(prevs))
	}

	var readerKeyMasks []keybase1.ReaderKeyMask
	if box != nil {
		for i := 1; i <= int(box.Generation); i++ {
			for _, app := range keybase1.TeamApplicationMap {
				bs, err := libkb.RandBytes(32)
				require.NoError(l.t, err)
				readerKeyMasks = append(readerKeyMasks, keybase1.ReaderKeyMask{
					Application: app,
					Generation:  keybase1.PerTeamKeyGeneration(i),
					Mask:        keybase1.MaskB64(bs),
				})
			}
		}
	}

	return &rawTeam{
		ID:             teamID,
		Name:           name,
		Status:         libkb.AppStatus{Code: libkb.SCOk},
		Chain:          links,
		Box:            box,
		Prevs:          prevs,
		ReaderKeyMasks: readerKeyMasks,
		SubteamReader:  l.state.loadSpec.SubteamReader,
	}, nil
}

func (l *MockLoaderContext) getMe(ctx context.Context) (res keybase1.UserVersion, err error) {
	defaultUserLabel := "herb"
	userSpec, ok := l.unit.Users[defaultUserLabel]
	if !ok {
		return res, NewMockBoundsError("PerUserEncryptionKey", "default user label", defaultUserLabel)
	}
	return NewUserVersion(userSpec.UID, userSpec.EldestSeqno), nil
}

func (l *MockLoaderContext) lookupEldestSeqno(ctx context.Context, uid keybase1.UID) (seqno keybase1.Seqno, err error) {
	for _, userSpec := range l.unit.Users {
		if userSpec.UID.String() == uid.String() {
			return userSpec.EldestSeqno, nil
		}
	}
	return seqno, NewMockBoundsError("LookupEldestSeqno", "uid", uid)
}

func (l *MockLoaderContext) resolveNameToIDUntrusted(ctx context.Context, teamName keybase1.TeamName) (id keybase1.TeamID, err error) {
	for name, teamSpec := range l.unit.Teams {
		if teamName.String() == name {
			id = teamSpec.ID
		}
	}
	if len(id) > 0 {
		return id, nil
	}
	return id, NewMockBoundsError("ResolveNameToIDUntrusted", "team name", teamName)
}

func (l *MockLoaderContext) perUserEncryptionKey(ctx context.Context, userSeqno keybase1.Seqno) (key *libkb.NaclDHKeyPair, err error) {
	if userSeqno == 0 {
		return key, NewMockError("mock got PerUserEncryptionKey request for seqno 0")
	}
	defaultUserLabel := "herb"
	userSpec, ok := l.unit.Users[defaultUserLabel]
	if !ok {
		return key, NewMockBoundsError("PerUserEncryptionKey", "default user label", defaultUserLabel)
	}
	hexSecret, ok := userSpec.PerUserKeySecrets[userSeqno]
	if !ok {
		return key, NewMockBoundsError("PerUserEncryptionKey", "seqno", userSeqno)
	}
	secret1, err := hex.DecodeString(hexSecret)
	if err != nil {
		return key, err
	}
	var secret libkb.PerUserKeySeed
	secret, err = libkb.MakeByte32Soft(secret1)
	if err != nil {
		return key, err
	}
	key, err = secret.DeriveDHKey()
	if err != nil {
		return key, err
	}
	return key, err
}

func (l *MockLoaderContext) merkleLookup(ctx context.Context, teamID keybase1.TeamID) (r1 keybase1.Seqno, r2 keybase1.LinkID, err error) {
	key := fmt.Sprintf("%s", teamID)
	if l.state.loadSpec.Upto > 0 {
		key = fmt.Sprintf("%s-seqno:%d", teamID, int64(l.state.loadSpec.Upto))
	}
	x, ok := l.unit.TeamMerkle[key]
	if !ok {
		return r1, r2, NewMockBoundsError("MerkleLookup", "team id (+?seqno)", key)
	}
	return x.Seqno, x.LinkID, nil
}

func (l *MockLoaderContext) merkleLookupTripleAtHashMeta(ctx context.Context,
	leafID keybase1.UserOrTeamID, hm keybase1.HashMeta) (triple *libkb.MerkleTriple, err error) {

	key := fmt.Sprintf("%s-%s", leafID, hm)
	triple1, ok := l.unit.MerkleTriples[key]
	if !ok {
		return nil, NewMockBoundsError("MerkleLookupTripleAtHashMeta", "LeafID-HashMeta", key)
	}
	if len(triple1.LinkID) == 0 {
		return nil, NewMockError("MerkleLookupTripleAtHashMeta is blank (%v, %v) -> %v", leafID, hm, triple1)
	}
	l.t.Logf("MockLoaderContext#MerkleLookupTripleAtHashMeta(%v, %v) -> %v", leafID, hm, triple1)
	return &triple1, nil
}

func (l *MockLoaderContext) forceLinkMapRefreshForUser(ctx context.Context, uid keybase1.UID) (linkMap map[keybase1.Seqno]keybase1.LinkID, err error) {
	panic("TODO")
	// if !ok {
	// 	return nil, NewMockBoundsError("ForceLinkMapRefreshForUser", "uid", uid)
	// }
	// return linkMap, nil
}

func (l *MockLoaderContext) loadKeyV2(ctx context.Context, uid keybase1.UID, kid keybase1.KID) (
	uv keybase1.UserVersion, pubKey *keybase1.PublicKeyV2NaCl, linkMap map[keybase1.Seqno]keybase1.LinkID,
	err error) {

	defer func() {
		l.t.Logf("MockLoaderContext#loadKeyV2(%v, %v) -> %v", uid, kid, err)
	}()

	userLabel, ok := l.unit.KeyOwners[kid]
	if !ok {
		return uv, pubKey, linkMap, NewMockBoundsError("LoadKeyV2", "kid", kid)
	}
	userSpec, ok := l.unit.Users[userLabel]
	if !ok {
		return uv, pubKey, linkMap, NewMockBoundsError("LoadKeyV2", "kid", kid)
	}
	if !uid.Equal(userSpec.UID) {
		return uv, pubKey, linkMap, NewMockError("LoadKeyV2 kid matched by wrong uid")
	}
	uv = keybase1.UserVersion{
		Uid:         userSpec.UID,
		EldestSeqno: userSpec.EldestSeqno,
	}

	pubKeyV2NaClJSON, ok := l.unit.KeyPubKeyV2NaCls[kid]
	if !ok {
		return uv, pubKey, linkMap, NewMockBoundsError("LoadKeyV2", "kid for KeyPubKeyV2NaCls", kid)
	}
	err = json.Unmarshal(pubKeyV2NaClJSON, &pubKey)
	if err != nil {
		return uv, pubKey, linkMap, NewMockError("unpacking pubKeyV2NaCl")
	}

	return uv, pubKey, userSpec.LinkMap, nil
}

type mockError struct {
	Msg string
}

func (e *mockError) Error() string {
	return fmt.Sprintf("error in mock: %s", e.Msg)
}

func NewMockError(format string, args ...interface{}) error {
	return &mockError{
		Msg: fmt.Sprintf(format, args...),
	}
}

func NewMockBoundsError(caller string, keydesc string, key interface{}) error {
	return &mockError{
		Msg: fmt.Sprintf("in %s: key not found (%s) %+v", caller, keydesc, key),
	}
}
