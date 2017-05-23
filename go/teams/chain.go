package teams

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

// There are a lot of TODOs in this file. Many of them are critical before team sigchains can be used safely.

// TODO CORE-5311 merkle existence
// TODO CORE-5313 CORE-5314 CORE-5315 accept links from now-revoked keys and now-reset users if the sigs were made before their revocation.

type TeamName string

type UserVersion struct {
	Username    libkb.NormalizedUsername
	EldestSeqno keybase1.Seqno
}

func NewUserVersion(username string, eldestSeqno keybase1.Seqno) UserVersion {
	return UserVersion{
		Username:    libkb.NewNormalizedUsername(username),
		EldestSeqno: eldestSeqno,
	}
}

func ParseUserVersion(s string) (res UserVersion, err error) {
	parts := strings.Split(s, "%")
	if len(parts) == 1 {
		// default to seqno 1
		parts = append(parts, "1")
	}
	if len(parts) != 2 {
		return res, fmt.Errorf("invalid user version: %s", s)
	}
	username, err := libkb.ValidateNormalizedUsername(parts[0])
	if err != nil {
		return res, err
	}
	eldestSeqno, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return res, fmt.Errorf("invalid eldest seqno: %s", err)
	}
	return UserVersion{
		Username:    username,
		EldestSeqno: keybase1.Seqno(eldestSeqno),
	}, nil
}

// "foo" for seqno 1 or "foo%6"
func (u UserVersion) PercentForm() string {
	if u.EldestSeqno == 1 {
		return u.Username.String()
	}
	return fmt.Sprintf("%s%%%d", u.Username, u.EldestSeqno)
}

// Does not canonicalize the name
func TeamNameFromString(s string) (res TeamName, err error) {
	if len(s) == 0 {
		return res, errors.New("zero length team name")
	}
	for _, part := range strings.Split(s, ".") {
		if !(len(part) >= 2 && len(part) <= 16) {
			return res, fmt.Errorf("team name wrong size:'%s' %v <= %v <= %v", part, 2, len(part), 16)
		}
		// underscores allowed, just not first or doubled
		re := regexp.MustCompile(`^([a-z0-9][a-z0-9_]?)+$`)
		if !re.MatchString(strings.ToLower(part)) {
			return res, fmt.Errorf("invalid team name:'%s'", s)
		}
	}
	return TeamName(s), nil
}

// Get the top level team id for this team name.
// Only makes sense for non-sub teams.
func (n TeamName) ToTeamID() keybase1.TeamID {
	low := strings.ToLower(string(n))
	sum := sha256.Sum256([]byte(low))
	bs := append(sum[:15], keybase1.TEAMID_SUFFIX)
	res, err := keybase1.TeamIDFromString(hex.EncodeToString(bs))
	if err != nil {
		panic(err)
	}
	return res
}

const TeamSigChainPlayerSupportedLinkVersion = 2

// A user became this role at a point in time
type UserTeamRoleCheckpoint struct {
	// The new role. Including NONE if the user left the team.
	Role keybase1.TeamRole
	// The seqno at which the user became this role.
	Seqno keybase1.Seqno
}

type UserLog map[UserVersion][]UserTeamRoleCheckpoint

func (ul *UserLog) getUserRole(u UserVersion) keybase1.TeamRole {
	log := (*ul)[u]
	if len(log) == 0 {
		return keybase1.TeamRole_NONE
	}
	role := log[len(log)-1].Role
	return role
}

// Inform the UserLog of a user's role.
// Doesn't check anything, don't screw up.
// Idempotent if called correctly.
func (ul *UserLog) inform(u UserVersion, role keybase1.TeamRole, seqno keybase1.Seqno) {
	currentRole := ul.getUserRole(u)
	if currentRole == role {
		// no change in role, now new checkpoint needed
		return
	}
	(*ul)[u] = append((*ul)[u], UserTeamRoleCheckpoint{
		Role:  role,
		Seqno: seqno,
	})
}

// State of a parsed team sigchain.
// Should be treated as immutable when returned from TeamSigChainPlayer.
// Modified internally to TeamSigChainPlayer.
type TeamSigChainState struct {
	// The user who loaded this sigchain
	Reader UserVersion

	ID keybase1.TeamID
	// Latest name of the team
	Name TeamName
	// The last link procesed
	LastSeqno  keybase1.Seqno
	LastLinkID libkb.LinkID

	// Present if a subteam
	ParentID *keybase1.TeamID

	// For each user, the timeline of their role status.
	// The role checkpoints are always ordered by seqno.
	// The latest role of the user is the role of their last checkpoint.
	// When a user leaves the team a NONE checkpoint appears in their list.
	UserLog UserLog

	PerTeamKeys map[int]keybase1.PerTeamKey

	// Set of types that were loaded stubbed-out and whose contents are missing.
	StubbedTypes map[libkb.SigchainV2Type]bool
}

func (t TeamSigChainState) DeepCopy() TeamSigChainState {

	stubbedTypes := make(map[libkb.SigchainV2Type]bool)
	for k, v := range t.StubbedTypes {
		stubbedTypes[k] = v
	}

	perTeamKeys := make(map[int]keybase1.PerTeamKey)
	for k, v := range t.PerTeamKeys {
		perTeamKeys[k] = v
	}

	userLog := make(UserLog)
	for k, v := range t.UserLog {
		userLog[k] = v
	}

	return TeamSigChainState{
		Reader:       t.Reader,
		ID:           t.ID,
		Name:         t.Name,
		LastSeqno:    t.LastSeqno,
		LastLinkID:   t.LastLinkID,
		ParentID:     t.ParentID,
		UserLog:      userLog,
		PerTeamKeys:  perTeamKeys,
		StubbedTypes: stubbedTypes,
	}
}

func (t *TeamSigChainState) GetName() TeamName {
	return t.Name
}

func (t *TeamSigChainState) IsSubteam() bool {
	return t.ParentID != nil
}

func (t *TeamSigChainState) GetLatestSeqno() keybase1.Seqno {
	return t.LastSeqno
}

func (t *TeamSigChainState) GetUserRole(user UserVersion) (keybase1.TeamRole, error) {
	return t.UserLog.getUserRole(user), nil
}

func (t *TeamSigChainState) GetUsersWithRole(role keybase1.TeamRole) (res []UserVersion, err error) {
	if role == keybase1.TeamRole_NONE {
		return nil, errors.New("cannot get users with NONE role")
	}
	for uv := range t.UserLog {
		if t.UserLog.getUserRole(uv) == role {
			res = append(res, uv)
		}
	}
	return res, nil
}

func (t *TeamSigChainState) GetLatestPerTeamKey() (keybase1.PerTeamKey, error) {
	res, ok := t.PerTeamKeys[len(t.PerTeamKeys)]
	if !ok {
		// if this happens it's a programming error
		return res, errors.New("per-team-key not found")
	}
	return res, nil
}

// UsernameFinder is an interface for TeamSigChainPlayer that can be mocked out for tests.
type UsernameFinder interface {
	UsernameForUID(context.Context, keybase1.UID) (string, error)
}

type TeamSigChainPlayer struct {
	sync.Mutex

	helper UsernameFinder

	// information about the reading user
	reader UserVersion

	isSubTeam bool

	storedState *TeamSigChainState
}

// Load a team chain from the perspective of uid.
func NewTeamSigChainPlayer(helper UsernameFinder, reader UserVersion, isSubTeam bool) *TeamSigChainPlayer {
	return &TeamSigChainPlayer{
		helper:      helper,
		reader:      reader,
		isSubTeam:   isSubTeam,
		storedState: nil,
	}
}

func (t *TeamSigChainPlayer) GetState() (res TeamSigChainState, err error) {
	t.Lock()
	defer t.Unlock()

	if t.storedState != nil {
		return t.storedState.DeepCopy(), nil
	}
	return res, fmt.Errorf("no links loaded")
}

func (t *TeamSigChainPlayer) AddChainLinks(ctx context.Context, links []SCChainLink) error {
	t.Lock()
	defer t.Unlock()

	return t.addChainLinksCommon(ctx, links, false)
}

// Add chain links from local storage. Skip verification checks that should have already been done.
func (t *TeamSigChainPlayer) AddChainLinksVerified(ctx context.Context, links []SCChainLink) error {
	t.Lock()
	defer t.Unlock()

	return t.addChainLinksCommon(ctx, links, true)
}

// Add links.
// Links must be added in batches because the check for what links are allowed to be stubbed
// depends on the user's _eventual_ role in the team.
// If this returns an error, the TeamSigChainPlayer was not modified.
func (t *TeamSigChainPlayer) addChainLinksCommon(ctx context.Context, links []SCChainLink, alreadyVerified bool) error {
	var err error
	if len(links) == 0 {
		return errors.New("no chainlinks to add")
	}

	var state *TeamSigChainState
	if t.storedState != nil {
		tmp := t.storedState.DeepCopy()
		state = &tmp
	}

	for _, link := range links {
		newState, err := t.addChainLinkCommon(ctx, state, link, alreadyVerified)
		if err != nil {
			if state == nil {
				return fmt.Errorf("seqno:1 %s", err)
			}
			return fmt.Errorf("seqno:%v %s", state.GetLatestSeqno(), err)
		}
		state = &newState
	}

	err = t.checkStubbed(*state)
	if err != nil {
		return fmt.Errorf("checking elided links: %s", err)
	}

	// Accept the new state
	t.storedState = state
	return nil
}

// Verify and add a chain link.
// Does not modify self or any arguments.
// The `prevState` argument is nil if this is the first chain link.
func (t *TeamSigChainPlayer) addChainLinkCommon(ctx context.Context, prevState *TeamSigChainState, link SCChainLink, alreadyVerified bool) (res TeamSigChainState, err error) {
	oRes, err := t.checkOuterLink(ctx, prevState, link, alreadyVerified)
	if err != nil {
		return res, fmt.Errorf("team sigchain outer link: %s", err)
	}

	stubbed := oRes.innerLink == nil

	var newState *TeamSigChainState
	if stubbed {
		if prevState == nil {
			return res, errors.New("first link cannot be stubbed")
		}
		newState2 := prevState.DeepCopy()
		newState = &newState2
	} else {
		iRes, err := t.addInnerLink(prevState, link, oRes, alreadyVerified)
		if err != nil {
			return res, fmt.Errorf("team sigchain inner link: %s", err)
		}
		newState = &iRes.newState
	}

	newState.LastSeqno = oRes.outerLink.Seqno
	newState.LastLinkID = oRes.outerLink.LinkID()

	if stubbed {
		newState.StubbedTypes[oRes.outerLink.LinkType] = true
	}

	return *newState, nil
}

type checkOuterLinkResult struct {
	outerLink   libkb.OuterLinkV2WithMetadata
	signingUser UserVersion

	// optional inner link info
	innerLink *SCChainLinkPayload
}

type checkInnerLinkResult struct {
	oRes     checkOuterLinkResult
	newState TeamSigChainState
}

func (t *TeamSigChainPlayer) checkOuterLink(ctx context.Context, prevState *TeamSigChainState, link SCChainLink, alreadyVerified bool) (res checkOuterLinkResult, err error) {
	if prevState == nil {
		if link.Seqno != 1 {
			return res, fmt.Errorf("expected seqno:1 but got:%v", link.Seqno)
		}
	} else {
		if link.Seqno != prevState.LastSeqno+1 {
			return res, fmt.Errorf("expected seqno:%v but got:%v", prevState.LastSeqno+1, link.Seqno)
		}
	}

	if link.Version != TeamSigChainPlayerSupportedLinkVersion {
		return res, fmt.Errorf("expected version:%v but got:%v", TeamSigChainPlayerSupportedLinkVersion, link.Version)
	}

	if len(link.Sig) == 0 {
		return res, errors.New("link has empty sig")
	}
	outerLink, err := libkb.DecodeOuterLinkV2(link.Sig)
	if err != nil {
		return res, err
	}
	res.outerLink = *outerLink

	// TODO CORE-5297 verify the sig. Without this this is all crazy.

	// TODO CORE-5297 verify the signers identity and authorization. Without this this is all crazy.

	// TODO support validating signatures even after account reset.
	//      we need the specified eldest seqno from the server for this.
	signerUID, err := keybase1.UIDFromString(string(link.UID))
	if err != nil {
		return res, fmt.Errorf("outer link signer uid: %s", err)
	}
	username, err := t.helper.UsernameForUID(ctx, signerUID)
	if err != nil {
		return res, err
	}
	// TODO for now just assume seqno=1. Need to do something else to support links made by since-reset users.
	res.signingUser = NewUserVersion(username, 1)

	// check that the outer link matches the server info
	err = outerLink.AssertSomeFields(link.Version, link.Seqno)
	if err != nil {
		return res, err
	}

	if prevState == nil {
		if len(outerLink.Prev) != 0 {
			return res, fmt.Errorf("expected outer nil prev but got:%s", outerLink.Prev)
		}
	} else {
		if !outerLink.Prev.Eq(prevState.LastLinkID) {
			return res, fmt.Errorf("wrong outer prev: %s != %s", outerLink.Prev, prevState.LastLinkID)
		}
	}

	if link.Payload == "" {
		// stubbed inner link
		res.innerLink = nil
	} else {
		payload, err := link.UnmarshalPayload()
		if err != nil {
			return res, fmt.Errorf("error unmarshaling link payload: %s", err)
		}
		res.innerLink = &payload
	}

	return res, nil
}

// Check and add the inner link.
// Does not modify `prevState` but returns a new state.
func (t *TeamSigChainPlayer) addInnerLink(prevState *TeamSigChainState, link SCChainLink, oRes checkOuterLinkResult, alreadyVerified bool) (res checkInnerLinkResult, err error) {
	res.oRes = oRes
	payload := *oRes.innerLink

	err = t.checkInnerOuterMatch(oRes.outerLink, payload, link.PayloadHash())
	if err != nil {
		return res, err
	}

	// completely ignore these fields
	_ = payload.Ctime
	_ = payload.ExpireIn
	_ = payload.SeqType

	if payload.Tag != "signature" {
		return res, fmt.Errorf("unrecognized tag: '%s'", payload.Tag)
	}

	if payload.Body.Team == nil {
		return res, errors.New("missing team section")
	}
	team := payload.Body.Team

	switch payload.Body.Type {
	case "team.root":
		if prevState != nil {
			return res, fmt.Errorf("link type 'team.root' unexpected at seqno:%v", prevState.LastSeqno+1)
		}
		if team.ID == nil {
			return res, errors.New("missing team id")
		}
		if team.Name == nil {
			return res, errors.New("missing name")
		}
		if team.Members == nil {
			return res, errors.New("missing members")
		}
		if team.Parent != nil {
			return res, errors.New("unexpected parent")
		}
		if team.Subteam != nil {
			return res, errors.New("unexpected subteam")
		}
		if team.PerTeamKey == nil {
			return res, errors.New("per-team-key missing")
		}

		teamID, err := keybase1.TeamIDFromString(string(*team.ID))
		if err != nil {
			return res, err
		}
		teamName, err := TeamNameFromString(string(*team.Name))
		if err != nil {
			return res, err
		}
		// check that team_name = hash(team_id)
		// this is only true for root teams
		if !teamID.Equal(teamName.ToTeamID()) {
			return res, fmt.Errorf("team id:%s does not match team name:%s", teamID, teamName)
		}

		roleUpdates, err := t.sanityCheckMembers(*team.Members, true)
		if err != nil {
			return res, err
		}

		userLog := t.makeInitialUserLog(roleUpdates)

		// check that the signer is an owner
		if userLog.getUserRole(oRes.signingUser) != keybase1.TeamRole_OWNER {
			return res, fmt.Errorf("signer is not an owner: %v (%v)", oRes.signingUser, team.Members.Owners)
		}

		perTeamKey, err := t.checkPerTeamKey(link, *team.PerTeamKey, 1)
		if err != nil {
			return res, err
		}

		perTeamKeys := make(map[int]keybase1.PerTeamKey)
		perTeamKeys[1] = perTeamKey

		res.newState = TeamSigChainState{
			Reader:       t.reader,
			ID:           teamID,
			Name:         teamName,
			LastSeqno:    1,
			LastLinkID:   oRes.outerLink.LinkID(),
			ParentID:     nil,
			UserLog:      userLog,
			PerTeamKeys:  perTeamKeys,
			StubbedTypes: make(map[libkb.SigchainV2Type]bool),
		}

		return res, nil
	case "team.change_membership":
		if prevState == nil {
			return res, fmt.Errorf("link type '%s' unexpected at seqno:%v", payload.Body.Type, prevState.LastSeqno+1)
		}
		if team.ID == nil {
			return res, errors.New("missing team id")
		}
		if team.Name != nil {
			return res, errors.New("unexpected name")
		}
		if team.Members == nil {
			return res, errors.New("missing members")
		}
		if team.Parent != nil {
			return res, errors.New("unexpected parent")
		}
		if team.Subteam != nil {
			return res, errors.New("unexpected subteam")
		}
		if team.PerTeamKey != nil {
			return res, errors.New("unexpected missing")
		}

		teamID, err := keybase1.TeamIDFromString(string(*team.ID))
		if err != nil {
			return res, err
		}

		if !prevState.ID.Equal(teamID) {
			return res, fmt.Errorf("wrong team id: %s != %s", teamID.String(), prevState.ID.String())
		}

		// Check that the signer is an admin or owner to have permission to make this link.
		signerRole, err := prevState.GetUserRole(oRes.signingUser)
		if err != nil {
			return res, err
		}
		switch signerRole {
		case keybase1.TeamRole_ADMIN, keybase1.TeamRole_OWNER:
			// ok
		default:
			return res, fmt.Errorf("link signer does not have permission to change membership: %v is a %v", oRes.signingUser, signerRole)
		}

		roleUpdates, err := t.sanityCheckMembers(*team.Members, false)
		if err != nil {
			return res, err
		}

		res.newState = prevState.DeepCopy()

		t.updateMembership(&res.newState.UserLog, roleUpdates, oRes.outerLink.Seqno)

		// Note: If someone was removed, the per-team-key should be rotated. This is not checked though.

		if team.PerTeamKey != nil {
			lastKey, err := prevState.GetLatestPerTeamKey()
			if err != nil {
				return res, fmt.Errorf("getting previous per-team-key: %s", err)
			}
			newKey, err := t.checkPerTeamKey(link, *team.PerTeamKey, lastKey.Gen+1)
			if err != nil {
				return res, err
			}
			res.newState.PerTeamKeys[newKey.Gen] = newKey
		}

		return res, nil
	case "team.rotate_key":
		if prevState == nil {
			return res, fmt.Errorf("link type 'team.rotate_key' unexpected at beginning of chain")
		}
		if team.ID == nil {
			return res, errors.New("missing team id")
		}
		if team.Name != nil {
			return res, errors.New("unexpected name")
		}
		if team.Members != nil {
			return res, errors.New("unexpected members")
		}
		if team.Parent != nil {
			return res, errors.New("unexpected parent")
		}
		if team.Subteam != nil {
			return res, errors.New("unexpected subteam")
		}
		if team.PerTeamKey == nil {
			return res, errors.New("missing per-team-key")
		}

		// Check that the signer is at least a writer to have permission to make this link.
		signerRole, err := prevState.GetUserRole(oRes.signingUser)
		if err != nil {
			return res, err
		}
		switch signerRole {
		case keybase1.TeamRole_WRITER, keybase1.TeamRole_ADMIN, keybase1.TeamRole_OWNER:
			// ok
		default:
			return res, fmt.Errorf("link signer does not have permission to rotate key: %v is a %v", oRes.signingUser, signerRole)
		}

		lastKey, err := prevState.GetLatestPerTeamKey()
		if err != nil {
			return res, fmt.Errorf("getting previous per-team-key: %s", err)
		}
		newKey, err := t.checkPerTeamKey(link, *team.PerTeamKey, lastKey.Gen+1)
		if err != nil {
			return res, err
		}

		res.newState = prevState.DeepCopy()
		res.newState.PerTeamKeys[newKey.Gen] = newKey

		return res, nil
	case "team.leave":
		return res, fmt.Errorf("todo implement parsing of: %s", payload.Body.Type) // TODO CORE-5305
	case "team.subteam_head":
		return res, fmt.Errorf("subteams not supported: %s", payload.Body.Type)
	case "team.new_subteam":
		return res, fmt.Errorf("subteams not supported: %s", payload.Body.Type)
	case "team.subteam_rename":
		return res, fmt.Errorf("subteams not supported: %s", payload.Body.Type)
	case "":
		return res, errors.New("empty body type")
	default:
		return res, fmt.Errorf("unsupported link type: %s", payload.Body.Type)
	}
}

// check that the inner link matches the outer link
func (t *TeamSigChainPlayer) checkInnerOuterMatch(outerLink libkb.OuterLinkV2WithMetadata, innerLink SCChainLinkPayload, innerLinkHash libkb.LinkID) (err error) {
	var innerPrev libkb.LinkID
	if innerLink.Prev != nil {
		innerPrev, err = libkb.LinkIDFromHex(*innerLink.Prev)
		if err != nil {
			return err
		}
	}

	innerLinkType, err := libkb.SigchainV2TypeFromV1TypeTeams(innerLink.Body.Type)
	if err != nil {
		return err
	}

	err = outerLink.AssertFields(innerLink.Body.Version, innerLink.Seqno, innerPrev, innerLinkHash, innerLinkType)
	if err != nil {
		return err
	}

	// TODO CORE-5300 check that the key section refers to the same kid that really signed.

	return nil
}

func (t *TeamSigChainPlayer) checkStubbed(state TeamSigChainState) error {
	// TODO CORE-5301 if you get kicked out of a team, that's special. The chain can't load.
	// But you should get to know why without erroring out.

	// Check that the server didn't stub out links it's not allowed to.
	// In some circumstances, this error can be special.
	// If the user's role was boosted then someone should trigger a reload of the chain with less links stubbed.
	role, err := state.GetUserRole(t.reader)
	if err != nil {
		return err
	}
	if role == keybase1.TeamRole_NONE {
		return errors.New("not a member of team")
	}
	for k, v := range state.StubbedTypes {
		if v {
			if !k.TeamAllowStub(role) {
				return fmt.Errorf("link stubbed when not allowed allowed; linktype:%v role:%v", k, role)
			}
		}
	}

	return nil
}

// Check that all the users are formatted correctly.
// Check that there are no duplicate members.
// `firstLink` is whether this is seqno=1. In which case owners must exist.
// Rotates to a map which has entries for the roles that actually appeared in the input, even if they are empty lists.
// In other words, if the input has only `admin -> []` then the output will have only `admin` in the map.
func (t *TeamSigChainPlayer) sanityCheckMembers(members SCTeamMembers, firstLink bool) (map[keybase1.TeamRole][]UserVersion, error) {
	type assignment struct {
		m    SCTeamMember
		role keybase1.TeamRole
	}
	var all []assignment

	if firstLink {
		if members.Owners == nil {
			return nil, fmt.Errorf("team has no owner list: %+v", members)
		}
		if len(*members.Owners) < 1 {
			return nil, fmt.Errorf("team has no owners: %+v", members)
		}
	}

	// Map from roles to users.
	res := make(map[keybase1.TeamRole][]UserVersion)

	if members.Owners != nil {
		res[keybase1.TeamRole_OWNER] = nil
		for _, m := range *members.Owners {
			all = append(all, assignment{m, keybase1.TeamRole_OWNER})
		}
	}
	if members.Admins != nil {
		res[keybase1.TeamRole_ADMIN] = nil
		for _, m := range *members.Admins {
			all = append(all, assignment{m, keybase1.TeamRole_ADMIN})
		}
	}
	if members.Writers != nil {
		res[keybase1.TeamRole_WRITER] = nil
		for _, m := range *members.Writers {
			all = append(all, assignment{m, keybase1.TeamRole_WRITER})
		}
	}
	if members.Readers != nil {
		res[keybase1.TeamRole_READER] = nil
		for _, m := range *members.Readers {
			all = append(all, assignment{m, keybase1.TeamRole_READER})
		}
	}

	// Set of users who have already been seen.
	seen := make(map[UserVersion]bool)

	for _, pair := range all {
		uv, err := ParseUserVersion(string(pair.m))
		if err != nil {
			return nil, err
		}

		if seen[uv] {
			return nil, fmt.Errorf("duplicate username in members: %s", uv.Username)
		}

		res[pair.role] = append(res[pair.role], uv)

		seen[uv] = true
	}

	return res, nil
}

func (t *TeamSigChainPlayer) checkPerTeamKey(link SCChainLink, perTeamKey SCPerTeamKey, expectedGeneration int) (res keybase1.PerTeamKey, err error) {
	// check the per-team-key
	if perTeamKey.Generation != expectedGeneration {
		return res, fmt.Errorf("per-team-key generation must start at 1 but got:%d", perTeamKey.Generation)
	}
	// TODO CORE-5302 validate KIDs
	// TODO CORE-5302 validate the reverse sig

	return keybase1.PerTeamKey{
		Gen:    perTeamKey.Generation,
		Seqno:  link.Seqno,
		SigKID: perTeamKey.SigKID,
		EncKID: perTeamKey.EncKID,
	}, nil
}

func (t *TeamSigChainPlayer) makeInitialUserLog(roleUpdates map[keybase1.TeamRole][]UserVersion) UserLog {
	userLog := make(UserLog)

	for role, uvs := range roleUpdates {
		for _, uv := range uvs {
			userLog.inform(uv, role, 1)
		}
	}

	return userLog
}

// Update `userLog` with the membership in roleUpdates.
// Users already in `userLog` who do not appear in `roleUpdates` and whose role does not appear in `roleUpdates` are unaffected.
// Users already in `userLog` who do not appear in `roleUpdates` but whose role does appear in `roleUpdates` are kicked out the team.
// Users already in `userLog` who appear with a different role than before are updated to that new role.
func (t *TeamSigChainPlayer) updateMembership(userLog *UserLog, roleUpdates map[keybase1.TeamRole][]UserVersion, seqno keybase1.Seqno) {
	// Set of users that were already processed
	processed := make(map[UserVersion]bool)

	for role, uvs := range roleUpdates {
		for _, uv := range uvs {
			userLog.inform(uv, role, seqno)
			processed[uv] = true
		}
	}

	// Kick users who were not processed and whose role is mentioned in roleUpdates.
	for uv := range *userLog {
		if !processed[uv] {
			role := (*userLog).getUserRole(uv)
			if role != keybase1.TeamRole_NONE {
				_, mentioned := roleUpdates[role]
				if mentioned {
					userLog.inform(uv, keybase1.TeamRole_NONE, seqno)
				}
			}
		}
	}

}
