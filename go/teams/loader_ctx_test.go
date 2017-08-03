package teams

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
)

type mockState struct {
	teamNames map[keybase1.TeamID]keybase1.TeamName
	teamIDs   map[string] /*TeamName*/ keybase1.TeamID
}

type MockLoaderContext struct {
	t     *testing.T
	state mockState
	unit  TestCase
}

var _ LoaderContext = (*MockLoaderContext)(nil)

func NewMockLoaderContext(t *testing.T, g *libkb.GlobalContext, unit TestCase) *MockLoaderContext {
	return &MockLoaderContext{
		t:    t,
		unit: unit,
	}
}

func (l *MockLoaderContext) GetNewLinksFromServer(ctx context.Context,
	teamID keybase1.TeamID, lows getLinksLows,
	readSubteamID *keybase1.TeamID) (*rawTeam, error) {

	return l.getLinksFromServer(ctx, teamID, lows, nil, readSubteamID)
}

func (l *MockLoaderContext) GetLinksFromServer(ctx context.Context,
	teamID keybase1.TeamID, requestSeqnos []keybase1.Seqno, readSubteamID *keybase1.TeamID) (*rawTeam, error) {

	return l.getLinksFromServer(ctx, teamID, getLinksLows{}, requestSeqnos, readSubteamID)
}

func (l *MockLoaderContext) getLinksFromServer(ctx context.Context,
	teamID keybase1.TeamID, lows getLinksLows,
	requestSeqnos []keybase1.Seqno, readSubteamID *keybase1.TeamID) (*rawTeam, error) {

	_ = readSubteamID // Allow all access.

	name, ok := l.state.teamNames[teamID]
	if !ok {
		return nil, NewMockBoundsError("getLinksFromServer", "teamID", teamID)
	}

	t, ok := l.unit.Teams[name.String()]
	if !ok {
		return nil, NewMockBoundsError("getLinksFromServer", "name", name)
	}

	var readerKeyMasks []keybase1.ReaderKeyMask
	for i := 1; i < 2; i++ {
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

	return &rawTeam{
		ID:             teamID,
		Name:           name,
		Status:         libkb.AppStatus{Code: libkb.SCOk},
		Chain:          t.Links,
		Box:            t.TeamKeyBox,
		Prevs:          make(map[keybase1.PerTeamKeyGeneration]prevKeySealedEncoded), // TODO
		ReaderKeyMasks: readerKeyMasks,                                               // TODO
		SubteamReader:  false,                                                        // TODO
	}, nil
}

func (l *MockLoaderContext) GetMe(ctx context.Context) (res keybase1.UserVersion, err error) {
	defaultUserLabel := "herb"
	userSpec, ok := l.unit.Users[defaultUserLabel]
	if !ok {
		return res, NewMockBoundsError("PerUserEncryptionKey", "default user label", defaultUserLabel)
	}
	return NewUserVersion(userSpec.UID, userSpec.EldestSeqno), nil
}

func (l *MockLoaderContext) LookupEldestSeqno(ctx context.Context, uid keybase1.UID) (seqno keybase1.Seqno, err error) {
	for _, userSpec := range l.unit.Users {
		if userSpec.UID.String() == uid.String() {
			return userSpec.EldestSeqno, nil
		}
	}
	return seqno, NewMockBoundsError("LookupEldestSeqno", "uid", uid)
}

func (l *MockLoaderContext) ResolveNameToIDUntrusted(ctx context.Context, teamName keybase1.TeamName) (id keybase1.TeamID, err error) {
	id, ok := l.state.teamIDs[teamName.String()]
	if !ok {
		return id, NewMockBoundsError("ResolveNameToIDUntrusted", "team name", teamName)
	}
	return id, nil
}

func (l *MockLoaderContext) PerUserEncryptionKey(ctx context.Context, userSeqno keybase1.Seqno) (key *libkb.NaclDHKeyPair, err error) {
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
		return key, errors.WithStack(err)
	}
	var secret libkb.PerUserKeySeed
	secret, err = libkb.MakeByte32Soft(secret1)
	if err != nil {
		return key, errors.WithStack(err)
	}
	key, err = secret.DeriveDHKey()
	if err != nil {
		return key, err
	}
	return key, err
}

func (l *MockLoaderContext) MerkleLookup(ctx context.Context, teamID keybase1.TeamID) (r1 keybase1.Seqno, r2 keybase1.LinkID, err error) {
	x, ok := l.unit.TeamMerkle[teamID]
	if !ok {
		return r1, r2, NewMockBoundsError("MerkleLookup", "team id", teamID)
	}
	return x.Seqno, x.LinkID, nil
}

func (l *MockLoaderContext) MerkleLookupTripleAtHashMeta(ctx context.Context,
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

func (l *MockLoaderContext) ForceLinkMapRefreshForUser(ctx context.Context, uid keybase1.UID) (linkMap map[keybase1.Seqno]keybase1.LinkID, err error) {
	panic("TODO")
	// if !ok {
	// 	return nil, NewMockBoundsError("ForceLinkMapRefreshForUser", "uid", uid)
	// }
	// return linkMap, nil
}

func (l *MockLoaderContext) LoadKeyV2(ctx context.Context, uid keybase1.UID, kid keybase1.KID) (
	uv keybase1.UserVersion, pubKey *keybase1.PublicKeyV2NaCl, linkMap map[keybase1.Seqno]keybase1.LinkID,
	err error) {

	userLabel, ok := l.unit.KeyOwners[kid]
	if !ok {
		return uv, pubKey, linkMap, NewMockBoundsError("LoadKeyV2", "kid", kid)
	}
	userSpec, ok := l.unit.Users[userLabel]
	if !ok {
		return uv, pubKey, linkMap, NewMockBoundsError("LoadKeyV2", "kid", kid)
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
	return errors.WithStack(&mockError{
		Msg: fmt.Sprintf("in %s: key not found (%s) %+v", caller, keydesc, key),
	})
}
