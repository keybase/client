package service

import (
	"encoding/hex"
	"errors"
	"fmt"
	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
	"stathat.com/c/ramcache"
	"sync"
	"time"
)

// identify3Session corresponds to a single screen showing a user profile.
// It maps 1:1 with an Identify2GUIID, and is labeled as such. Here we'll keep
// track of whatever context we need to pass across calls, and also the TrackToken
// for the final result.
type identify3Session struct {
	sync.Mutex
	created time.Time
	id      keybase1.Identify3GUIID
	outcome *libkb.IdentifyOutcome
}

func newIdentify3GUIID() (keybase1.Identify3GUIID, error) {
	var b []byte
	l := 12
	b, err := libkb.RandBytes(l)
	if err != nil {
		return keybase1.Identify3GUIID(""), err
	}
	b[l-1] = 0x34
	return keybase1.Identify3GUIID(hex.EncodeToString(b)), nil
}

func newIdentify3Session(mctx libkb.MetaContext) (*identify3Session, error) {
	id, err := newIdentify3GUIID()
	if err != nil {
		return nil, err
	}
	ret := &identify3Session{
		created: mctx.G().GetClock().Now(),
		id:      id,
	}
	mctx.CDebugf("generated new identify3 session: %s", id)
	return ret, nil
}

// identify3Handler handles one RPC in the identify3 flow
type identify3Handler struct {
	libkb.Contextified
	state *identify3State
	xp    rpc.Transporter
}

// identify3State keeps track of all active ID3 state across the whole app. It has
// a cache that's periodically cleaned up.
type identify3State struct {
	sync.Mutex

	// Table of keybase1.Identify3GUIID -> *identify3Session's
	cache *ramcache.Ramcache
}

func newIdentify3State(g *libkb.GlobalContext) *identify3State {
	ret := &identify3State{}
	ret.makeNewCache()
	return ret
}

func (s *identify3State) makeNewCache() {
	s.Lock()
	defer s.Unlock()
	if s.cache != nil {
		s.cache.Shutdown()
	}
	cache := ramcache.New()
	cache.MaxAge = 24 * time.Hour
	s.cache = cache
}

// get an identify3Session out of the cache, as keyed by a Identify3GUIID. Return
// (nil, f, nil) if not found. Return (nil, f, Error) if there was an expected error.
// Return (i, f, nil) if found, where i is the **locked** object. In all cases, the
// caller must call f() before exiting, either to unlock the locked object, or to
// just noop.
func (s *identify3State) get(key keybase1.Identify3GUIID) (ret *identify3Session, unlocker func(), err error) {
	s.Lock()
	defer s.Unlock()
	return s.getLocked(key)
}

func (s *identify3State) getLocked(key keybase1.Identify3GUIID) (ret *identify3Session, unlocker func(), err error) {
	v, err := s.cache.Get(string(key))
	unlocker = func() {}
	if err != nil {
		// NotFound isn't an error case
		if err == ramcache.ErrNotFound {
			return nil, unlocker, nil
		}
		return nil, unlocker, err
	}
	outcome, ok := v.(*identify3Session)
	if !ok {
		return nil, unlocker, fmt.Errorf("invalid type in cache: %T", v)
	}
	outcome.Lock()
	unlocker = func() { outcome.Unlock() }
	return outcome, unlocker, nil
}

func (s *identify3State) put(sess *identify3Session) error {
	s.Lock()
	defer s.Unlock()

	tmp, unlocker, err := s.getLocked(sess.id)
	defer unlocker()
	if err != nil {
		return err
	}
	if tmp != nil {
		unlocker()
		return libkb.ExistsError{Msg: "Identify3 ID already exists"}
	}
	return s.cache.Set(string(sess.id), sess)
}

func (s *identify3State) Reset(mctx libkb.MetaContext) {
	s.makeNewCache()
}

func newIdentify3Handler(xp rpc.Transporter, g *libkb.GlobalContext, state *identify3State) *identify3Handler {
	return &identify3Handler{
		Contextified: libkb.NewContextified(g),
		xp:           xp,
	}
}

var _ keybase1.Identify3Interface = (*identify3Handler)(nil)

func (i *identify3Handler) Identify3(ctx context.Context, arg keybase1.Identify3Arg) (err error) {
	mctx := libkb.NewMetaContext(ctx, i.G())
	mctx = mctx.WithLogTag("ID3")
	defer mctx.CTrace(fmt.Sprintf("Identify3(%+v)", arg), func() error { return err })()

	sess, err := newIdentify3Session(mctx)
	if err != nil {
		return err
	}
	err = i.state.put(sess)
	if err != nil {
		return err
	}

	cli := rpc.NewClient(i.xp, libkb.NewContextifiedErrorUnwrapper(mctx.G()), nil)
	id3cli := keybase1.Identify3UiClient{Cli: cli}
	ui, err := NewIdentify3UIAdapterWithSession(mctx, id3cli, i.state, sess)
	if err != nil {
		return err
	}
	i2arg := keybase1.Identify2Arg{
		UserAssertion:    string(arg.Assertion),
		ForceRemoteCheck: arg.IgnoreCache,
		ForceDisplay:     true,
		IdentifyBehavior: keybase1.TLFIdentifyBehavior_GUI_PROFILE,
	}
	mctx = mctx.WithIdentifyUI(ui)
	eng := engine.NewResolveThenIdentify2(mctx.G(), &i2arg)
	err = engine.RunEngine2(mctx, eng)
	if err != nil {
		return err
	}

	return nil
}

func (i *identify3Handler) Identify3FollowUser(context.Context, keybase1.Identify3FollowUserArg) error {
	return unimplemented()
}
func (i *identify3Handler) Identify3IgnoreUser(context.Context, keybase1.Identify3GUIID) error {
	return unimplemented()
}

// Identify3UIAdapter converts between the Identify2 UI that Identify2 engine expects, and the
// Identify3UI interface that the frontend is soon to implement. It's going to maintain the
// state machine that was previously implemented in JS.
type Identify3UIAdapter struct {
	state   *identify3State
	session *identify3Session
}

var _ libkb.IdentifyUI = (*Identify3UIAdapter)(nil)

func unimplemented() error {
	return errors.New("unimplemented")
}

func NewIdentify3UIAdapter(mctx libkb.MetaContext, cli keybase1.Identify3UiClient, state *identify3State) (*Identify3UIAdapter, error) {
	ret := &Identify3UIAdapter{
		state: state,
	}
	return ret, nil
}

func NewIdentify3UIAdapterWithSession(mctx libkb.MetaContext, cli keybase1.Identify3UiClient, state *identify3State, sess *identify3Session) (*Identify3UIAdapter, error) {
	ret, err := NewIdentify3UIAdapter(mctx, cli, state)
	if err != nil {
		return nil, err
	}
	ret.session = sess
	return ret, nil
}

func (i *Identify3UIAdapter) Start(string, keybase1.IdentifyReason, bool) error {
	return unimplemented()
}
func (i *Identify3UIAdapter) FinishWebProofCheck(keybase1.RemoteProof, keybase1.LinkCheckResult) error {
	return unimplemented()
}
func (i *Identify3UIAdapter) FinishSocialProofCheck(keybase1.RemoteProof, keybase1.LinkCheckResult) error {
	return unimplemented()
}
func (i *Identify3UIAdapter) Confirm(*keybase1.IdentifyOutcome) (keybase1.ConfirmResult, error) {
	return keybase1.ConfirmResult{}, unimplemented()
}
func (i *Identify3UIAdapter) DisplayCryptocurrency(keybase1.Cryptocurrency) error {
	return unimplemented()
}
func (i *Identify3UIAdapter) DisplayKey(keybase1.IdentifyKey) error {
	return unimplemented()
}
func (i *Identify3UIAdapter) ReportLastTrack(*keybase1.TrackSummary) error {
	return unimplemented()
}
func (i *Identify3UIAdapter) LaunchNetworkChecks(*keybase1.Identity, *keybase1.User) error {
	return unimplemented()
}
func (i *Identify3UIAdapter) DisplayTrackStatement(string) error {
	return unimplemented()
}
func (i *Identify3UIAdapter) DisplayUserCard(keybase1.UserCard) error {
	return unimplemented()
}
func (i *Identify3UIAdapter) ReportTrackToken(keybase1.TrackToken) error {
	return unimplemented()
}
func (i *Identify3UIAdapter) Cancel() error {
	return unimplemented()
}
func (i *Identify3UIAdapter) Finish() error {
	return unimplemented()
}
func (i *Identify3UIAdapter) DisplayTLFCreateWithInvite(keybase1.DisplayTLFCreateWithInviteArg) error {
	return unimplemented()
}
func (i *Identify3UIAdapter) Dismiss(string, keybase1.DismissReason) error {
	return unimplemented()
}
