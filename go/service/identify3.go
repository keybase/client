package service

import (
	"errors"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
	"time"
)

// identify3Session corresponds to a single screen showing a user profile.
// It maps 1:1 with an Identify2GUIID, and is labeled as such. Here we'll keep
// track of whatever context we need to pass across calls, and also the TrackToken
// for the final result.
type identify3Session struct {
	created time.Time
}

// identify3Handler handles one RPC in the identify3 flow
type identify3Handler struct {
	state   *identify3State
	session *identify3Session
}

// identify3State keeps track of all active ID3 state across the whole app. It has
// a cache that's periodically cleaned up.
type identify3State struct {
	state      map[keybase1.Identify3GUIID](*identify3Session)
	cleanOrder []keybase1.Identify3GUIID
}

func newIdentify3State(g *libkb.GlobalContext) *identify3State {
	return &identify3State{}
}

func newIdentify3Handler(xp rpc.Transporter, g *libkb.GlobalContext, state *identify3State) *identify3Handler {
	return &identify3Handler{}
}

var _ keybase1.Identify3Interface = (*identify3Handler)(nil)

func (i *identify3Handler) Identify3(context.Context, keybase1.Identify3Arg) error {
	return unimplemented()
}
func (i *identify3Handler) Identify3FollowUser(context.Context, keybase1.Identify3FollowUserArg) error {
	return unimplemented()
}
func (i *identify3Handler) Identify3IgnoreUser(context.Context, keybase1.Identify3GUIID) error {
	return unimplemented()
}

type Identify3UIWrapper struct {
}

var _ libkb.IdentifyUI = (*Identify3UIWrapper)(nil)

func unimplemented() error {
	return errors.New("unimplemented")
}

func NewIdentify3UIWrapper(m libkb.MetaContext, cli keybase1.Identify3UiClient) (*Identify3UIWrapper, error) {
	return nil, unimplemented()
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
