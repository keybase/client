package service

import (
	"encoding/hex"
	"errors"
	"fmt"
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

func newIdentifySession(g *libkb.GlobalContext) (*identify3Session, error) {
	id, err := newIdentify3GUIID()
	if err != nil {
		return nil, err
	}
	ret := &identify3Session{
		created: g.GetClock().Now(),
		id:      id,
	}
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
	cache *ramcache.Ramcache
}

func newIdentify3State(g *libkb.GlobalContext) *identify3State {
	cache := ramcache.New()
	cache.MaxAge = 24 * time.Hour
	return &identify3State{
		cache: cache,
	}
}

func (s *identify3State) get(key keybase1.Identify3GUIID) (*identify3Session, error) {
	s.Lock()
	defer s.Unlock()
	v, err := s.cache.Get(string(key))
	if err != nil {
		if err == ramcache.ErrNotFound {
			return nil, libkb.NotFoundError{Msg: "Identify3 state not found for ID; did it time out?"}
		}
		return nil, err
	}
	outcome, ok := v.(*identify3Session)
	if !ok {
		return nil, fmt.Errorf("invalid type in cache: %T", v)
	}
	return outcome, nil
}

func (s *identify3State) put(sess *identify3Session) error {
	s.Lock()
	defer s.Unlock()

	tmp, err := s.get(sess.id)
	if err != nil {
		return err
	}
	if tmp != nil {
		return libkb.ExistsError{Msg: "Identify3 ID already exists"}
	}
	return s.cache.Set(string(sess.id), sess)
}

func newIdentify3Handler(xp rpc.Transporter, g *libkb.GlobalContext, state *identify3State) *identify3Handler {
	return &identify3Handler{
		Contextified: libkb.NewContextified(g),
		xp:           xp,
	}
}

var _ keybase1.Identify3Interface = (*identify3Handler)(nil)

func (i *identify3Handler) Identify3(ctx context.Context, arg keybase1.Identify3Arg) (err error) {
	m := libkb.NewMetaContext(ctx, i.G())
	m = m.WithLogTag("ID3")
	defer m.CTrace(fmt.Sprintf("Identify3(%+v)", arg), func() error { return err })()

	sess, err := newIdentifySession(m.G())
	if err != nil {
		return err
	}
	err = i.state.put(sess)
	if err != nil {
		return err
	}

	cli := rpc.NewClient(i.xp, libkb.NewContextifiedErrorUnwrapper(m.G()), nil)
	id3cli := keybase1.Identify3UiClient{Cli: cli}
	ui, err := NewIdentify3UIWrapperWithSession(m, id3cli, i.state, sess)
	if err != nil {
		return err
	}
	m = m.WithIdentifyUI(ui)

	return unimplemented()
}

func (i *identify3Handler) Identify3FollowUser(context.Context, keybase1.Identify3FollowUserArg) error {
	return unimplemented()
}
func (i *identify3Handler) Identify3IgnoreUser(context.Context, keybase1.Identify3GUIID) error {
	return unimplemented()
}

type Identify3UIWrapper struct {
	state   *identify3State
	session *identify3Session
}

var _ libkb.IdentifyUI = (*Identify3UIWrapper)(nil)

func unimplemented() error {
	return errors.New("unimplemented")
}

func NewIdentify3UIWrapper(m libkb.MetaContext, cli keybase1.Identify3UiClient, state *identify3State) (*Identify3UIWrapper, error) {
	ret := &Identify3UIWrapper{
		state: state,
	}
	return ret, nil
}

func NewIdentify3UIWrapperWithSession(m libkb.MetaContext, cli keybase1.Identify3UiClient, state *identify3State, sess *identify3Session) (*Identify3UIWrapper, error) {
	ret, err := NewIdentify3UIWrapper(m, cli, state)
	if err != nil {
		return nil, err
	}
	ret.session = sess
	return ret, nil
}

func (i *Identify3UIWrapper) Start(string, keybase1.IdentifyReason, bool) error {
	return unimplemented()
}
func (i *Identify3UIWrapper) FinishWebProofCheck(keybase1.RemoteProof, keybase1.LinkCheckResult) error {
	return unimplemented()
}
func (i *Identify3UIWrapper) FinishSocialProofCheck(keybase1.RemoteProof, keybase1.LinkCheckResult) error {
	return unimplemented()
}
func (i *Identify3UIWrapper) Confirm(*keybase1.IdentifyOutcome) (keybase1.ConfirmResult, error) {
	return keybase1.ConfirmResult{}, unimplemented()
}
func (i *Identify3UIWrapper) DisplayCryptocurrency(keybase1.Cryptocurrency) error {
	return unimplemented()
}
func (i *Identify3UIWrapper) DisplayKey(keybase1.IdentifyKey) error {
	return unimplemented()
}
func (i *Identify3UIWrapper) ReportLastTrack(*keybase1.TrackSummary) error {
	return unimplemented()
}
func (i *Identify3UIWrapper) LaunchNetworkChecks(*keybase1.Identity, *keybase1.User) error {
	return unimplemented()
}
func (i *Identify3UIWrapper) DisplayTrackStatement(string) error {
	return unimplemented()
}
func (i *Identify3UIWrapper) DisplayUserCard(keybase1.UserCard) error {
	return unimplemented()
}
func (i *Identify3UIWrapper) ReportTrackToken(keybase1.TrackToken) error {
	return unimplemented()
}
func (i *Identify3UIWrapper) Cancel() error {
	return unimplemented()
}
func (i *Identify3UIWrapper) Finish() error {
	return unimplemented()
}
func (i *Identify3UIWrapper) DisplayTLFCreateWithInvite(keybase1.DisplayTLFCreateWithInviteArg) error {
	return unimplemented()
}
func (i *Identify3UIWrapper) Dismiss(string, keybase1.DismissReason) error {
	return unimplemented()
}
