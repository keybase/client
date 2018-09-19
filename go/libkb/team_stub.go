package libkb

import (
	"fmt"
	"time"

	gregor "github.com/keybase/client/go/gregor"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

type nullTeamLoader struct {
	Contextified
}

var _ TeamLoader = (*nullTeamLoader)(nil)

func newNullTeamLoader(g *GlobalContext) *nullTeamLoader {
	return &nullTeamLoader{NewContextified(g)}
}

// VerifyTeamName verifies that id corresponds to name and returns an error
// if it doesn't. Right now, it is a Noop (and therefore insecure) to get
// tests to pass. Once we have an actual implementation, we should change this
// to error out in all cases.
func (n nullTeamLoader) VerifyTeamName(ctx context.Context, id keybase1.TeamID, name keybase1.TeamName) error {
	return fmt.Errorf("null team loader")
}

func (n nullTeamLoader) ImplicitAdmins(ctx context.Context, teamID keybase1.TeamID) (impAdmins []keybase1.UserVersion, err error) {
	return nil, fmt.Errorf("null team loader")
}

// MapIDToName maps the team ID to the corresponding name, and can be serviced
// from the team cache. If no entry is available in the cache, it is OK to return
// an empty/nil TeamName, and callers are free to try again with a server access
// (this actually happens in the Resolver).
func (n nullTeamLoader) MapIDToName(ctx context.Context, id keybase1.TeamID) (keybase1.TeamName, error) {
	return keybase1.TeamName{}, fmt.Errorf("null team loader")
}

func (n nullTeamLoader) NotifyTeamRename(ctx context.Context, id keybase1.TeamID, newName string) error {
	return nil
}

func (n nullTeamLoader) Load(context.Context, keybase1.LoadTeamArg) (*keybase1.TeamData, error) {
	return nil, fmt.Errorf("null team loader")
}

func (n nullTeamLoader) Delete(context.Context, keybase1.TeamID) error {
	return nil
}

func (n *nullTeamLoader) HintLatestSeqno(ctx context.Context, id keybase1.TeamID, seqno keybase1.Seqno) error {
	return nil
}

func (n *nullTeamLoader) ResolveNameToIDUntrusted(ctx context.Context, teamName keybase1.TeamName, public bool, allowCache bool) (id keybase1.TeamID, err error) {
	return id, fmt.Errorf("null team loader")
}

func (n *nullTeamLoader) ForceRepollUntil(ctx context.Context, t gregor.TimeOrOffset) error {
	return nil
}

func (n nullTeamLoader) OnLogout() {}

func (n nullTeamLoader) ClearMem() {}

type nullFastTeamLoader struct{}

var _ FastTeamLoader = nullFastTeamLoader{}

func (n nullFastTeamLoader) Load(MetaContext, keybase1.FastTeamLoadArg) (keybase1.FastTeamLoadRes, error) {
	return keybase1.FastTeamLoadRes{}, fmt.Errorf("null fast team loader")
}

func (n nullFastTeamLoader) HintLatestSeqno(_ MetaContext, _ keybase1.TeamID, _ keybase1.Seqno) error {
	return nil
}

func (n nullFastTeamLoader) OnLogout() {}

func newNullFastTeamLoader() nullFastTeamLoader { return nullFastTeamLoader{} }

type nullTeamAuditor struct{}

var _ TeamAuditor = nullTeamAuditor{}

func (n nullTeamAuditor) AuditTeam(m MetaContext, id keybase1.TeamID, isPublic bool, headMerkleSeqno keybase1.Seqno, chain map[keybase1.Seqno]keybase1.LinkID, maxSeqno keybase1.Seqno) (err error) {
	return fmt.Errorf("null team auditor")
}

func (n nullTeamAuditor) OnLogout(m MetaContext) {}

func newNullTeamAuditor() nullTeamAuditor { return nullTeamAuditor{} }

type TeamAuditParams struct {
	RootFreshness time.Duration
	// After this many new Merkle updates, another audit is triggered.
	MerkleMovementTrigger keybase1.Seqno
	NumPreProbes          int
	NumPostProbes         int
	Parallelism           int
	LRUSize               int
}
