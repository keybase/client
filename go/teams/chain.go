package teams

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"

	"golang.org/x/net/context"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

// There are a lot of TODOs in this file. Many of them are critical before team sigchains can be used safely.

// TODO CORE-5311 merkle existence
// TODO CORE-5313 CORE-5314 CORE-5315 accept links from now-revoked keys and now-reset users if the sigs were made before their revocation.

// Create a new user/version pair.
func NewUserVersion(uid keybase1.UID, eldestSeqno keybase1.Seqno) keybase1.UserVersion {
	return keybase1.UserVersion{
		Uid:         uid,
		EldestSeqno: eldestSeqno,
	}
}

func ParseUserVersion(s string) (res keybase1.UserVersion, err error) {
	parts := strings.Split(s, "%")
	if len(parts) == 1 {
		// default to seqno 1
		parts = append(parts, "1")
	}
	if len(parts) != 2 {
		return res, fmt.Errorf("invalid user version: %s", s)
	}
	uid, err := libkb.UIDFromHex(parts[0])
	if err != nil {
		return res, err
	}
	eldestSeqno, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return res, fmt.Errorf("invalid eldest seqno: %s", err)
	}
	return keybase1.UserVersion{
		Uid:         uid,
		EldestSeqno: keybase1.Seqno(eldestSeqno),
	}, nil
}

const TeamSigChainPlayerSupportedLinkVersion = 2

// Accessor wrapper for keybase1.TeamSigChainState
type TeamSigChainState struct {
	inner keybase1.TeamSigChainState
}

func (t TeamSigChainState) DeepCopy() TeamSigChainState {
	return TeamSigChainState{
		inner: t.inner.DeepCopy(),
	}
}

func (t TeamSigChainState) GetID() keybase1.TeamID {
	return t.inner.Id
}

func (t TeamSigChainState) GetName() keybase1.TeamName {
	return t.inner.Name
}

func (t TeamSigChainState) IsSubteam() bool {
	return t.inner.ParentID != nil
}

func (t TeamSigChainState) GetLatestSeqno() keybase1.Seqno {
	return t.inner.LastSeqno
}

func (t TeamSigChainState) GetLatestLinkID() keybase1.LinkID {
	return t.inner.LastLinkID
}

func (t TeamSigChainState) GetUserRole(user keybase1.UserVersion) (keybase1.TeamRole, error) {
	return t.getUserRole(user), nil
}

func (t TeamSigChainState) GetUserLogPoint(user keybase1.UserVersion) *keybase1.UserLogPoint {
	points := t.inner.UserLog[user]
	if len(points) == 0 {
		return nil
	}
	tmp := points[len(points)-1].DeepCopy()
	return &tmp
}

func (t TeamSigChainState) GetAdminUserLogPoint(user keybase1.UserVersion) *keybase1.UserLogPoint {
	ret := t.GetUserLogPoint(user)
	if ret == nil {
		return nil
	}
	if ret.Role != keybase1.TeamRole_ADMIN && ret.Role != keybase1.TeamRole_OWNER {
		return nil
	}
	return ret
}

func (t TeamSigChainState) getUserRole(user keybase1.UserVersion) keybase1.TeamRole {
	points := t.inner.UserLog[user]
	if len(points) == 0 {
		return keybase1.TeamRole_NONE
	}
	role := points[len(points)-1].Role
	return role
}

func (t TeamSigChainState) GetUsersWithRole(role keybase1.TeamRole) (res []keybase1.UserVersion, err error) {
	if role == keybase1.TeamRole_NONE {
		return nil, errors.New("cannot get users with NONE role")
	}
	for uv := range t.inner.UserLog {
		if t.getUserRole(uv) == role {
			res = append(res, uv)
		}
	}
	return res, nil
}

func (t TeamSigChainState) GetLatestPerTeamKey() (keybase1.PerTeamKey, error) {
	res, ok := t.inner.PerTeamKeys[keybase1.PerTeamKeyGeneration(len(t.inner.PerTeamKeys))]
	if !ok {
		// if this happens it's a programming error
		return res, errors.New("per-team-key not found")
	}
	return res, nil
}

func (t TeamSigChainState) GetPerTeamKeyAtGeneration(gen keybase1.PerTeamKeyGeneration) (keybase1.PerTeamKey, error) {
	res, ok := t.inner.PerTeamKeys[gen]
	if !ok {
		return keybase1.PerTeamKey{}, libkb.NotFoundError{Msg: fmt.Sprintf("per-team-key not found for generation %d", gen)}
	}
	return res, nil
}

func (t TeamSigChainState) HasAnyStubbedLinks() bool {
	for _, v := range t.inner.StubbedTypes {
		if v {
			return true
		}
	}
	return false
}

// Inform the UserLog of a user's role.
// Mutates the UserLog.
// Must be called with seqno's and events in correct order.
// Idempotent if called correctly.
func (t *TeamSigChainState) inform(u keybase1.UserVersion, role keybase1.TeamRole, seqno keybase1.Seqno) {
	currentRole := t.getUserRole(u)
	if currentRole == role {
		// no change in role, now new checkpoint needed
		return
	}
	t.inner.UserLog[u] = append(t.inner.UserLog[u], keybase1.UserLogPoint{
		Role:  role,
		Seqno: seqno,
	})
}

// Threadsafe handle to a local model of a team sigchain.
type TeamSigChainPlayer struct {
	libkb.Contextified
	sync.Mutex

	// information about the reading user
	reader keybase1.UserVersion

	storedState *TeamSigChainState
}

// Load a team chain from the perspective of uid.
func NewTeamSigChainPlayer(g *libkb.GlobalContext, reader keybase1.UserVersion) *TeamSigChainPlayer {
	return &TeamSigChainPlayer{
		Contextified: libkb.NewContextified(g),
		reader:       reader,
		storedState:  nil,
	}
}

func NewTeamSigChainPlayerWithState(g *libkb.GlobalContext, reader keybase1.UserVersion, state TeamSigChainState) *TeamSigChainPlayer {
	res := NewTeamSigChainPlayer(g, reader)
	res.storedState = &state
	return res
}

func (t *TeamSigChainPlayer) GetState() (res TeamSigChainState, err error) {
	t.Lock()
	defer t.Unlock()

	if t.storedState != nil {
		// The caller shouldn't modify the returned value, but that's really easy to screw up
		// so DeepCopy to defend our internal state.
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
		state = t.storedState
	}

	for _, link := range links {
		newState, err := t.addChainLinkCommon(ctx, state, link, alreadyVerified)
		if err != nil {
			if state == nil {
				return fmt.Errorf("at beginning: %v", err)
			}
			return fmt.Errorf("at seqno %v: %v", state.GetLatestSeqno(), err)
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
// The `prevState` argument is nil if this is the first chain link. `prevState` must not be modified in this function.
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

	newState.inner.LastSeqno = oRes.outerLink.Seqno
	newState.inner.LastLinkID = oRes.outerLink.LinkID().Export()

	if stubbed {
		newState.inner.StubbedTypes[int(oRes.outerLink.LinkType)] = true
	}

	return *newState, nil
}

type checkOuterLinkResult struct {
	outerLink   libkb.OuterLinkV2WithMetadata
	signingUser keybase1.UserVersion

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
		if link.Seqno != prevState.inner.LastSeqno+1 {
			return res, fmt.Errorf("expected seqno:%v but got:%v", prevState.inner.LastSeqno+1, link.Seqno)
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
	// TODO for now just assume seqno=1. Need to do something else to support links made by since-reset users.
	res.signingUser = NewUserVersion(link.UID, 1)

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
		prevStateLastLinkID, err := libkb.ImportLinkID(prevState.inner.LastLinkID)
		if err != nil {
			return res, fmt.Errorf("invalid prev last link id: %v", err)
		}
		if !outerLink.Prev.Eq(prevStateLastLinkID) {
			return res, fmt.Errorf("wrong outer prev: %s != %s", outerLink.Prev, prevState.inner.LastLinkID)
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

	if len(team.ID) == 0 {
		return res, errors.New("missing team id")
	}
	teamID, err := keybase1.TeamIDFromString(string(team.ID))
	if err != nil {
		return res, err
	}

	if prevState != nil && !prevState.inner.Id.Equal(teamID) {
		return res, fmt.Errorf("wrong team id: %s != %s", teamID.String(), prevState.inner.Id.String())
	}

	hasPrevState := func(has bool) error {
		if has {
			if prevState == nil {
				return fmt.Errorf("link type '%s' unexpected at beginning", payload.Body.Type)
			}
		} else {
			if prevState != nil {
				return fmt.Errorf("link type '%s' unexpected at seqno:%v", payload.Body.Type, prevState.inner.LastSeqno+1)
			}
		}
		return nil
	}
	hasGeneric := func(hasExpected bool, hasReal bool, attr string) error {
		if hasExpected != hasReal {
			if hasReal {
				return fmt.Errorf("unexpected %s", attr)
			}
			return fmt.Errorf("missing %s", attr)
		}
		return nil
	}
	hasName := func(has bool) error {
		return hasGeneric(has, team.Name != nil, "name")
	}
	hasMembers := func(has bool) error {
		return hasGeneric(has, team.Members != nil, "members")
	}
	hasParent := func(has bool) error {
		return hasGeneric(has, team.Parent != nil, "parent")
	}
	hasSubteam := func(has bool) error {
		return hasGeneric(has, team.Subteam != nil, "subteam")
	}
	hasPerTeamKey := func(has bool) error {
		return hasGeneric(has, team.PerTeamKey != nil, "per-team-key")
	}

	switch payload.Body.Type {
	case "team.root":
		err = libkb.PickFirstError(
			hasPrevState(false),
			hasName(true),
			hasMembers(true),
			hasParent(false),
			hasSubteam(false),
			hasPerTeamKey(true))
		if err != nil {
			return res, err
		}

		// TODO check that team name has no dots
		teamName, err := keybase1.TeamNameFromString(string(*team.Name))
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

		perTeamKey, err := t.checkPerTeamKey(link, *team.PerTeamKey, 1)
		if err != nil {
			return res, err
		}

		perTeamKeys := make(map[keybase1.PerTeamKeyGeneration]keybase1.PerTeamKey)
		perTeamKeys[keybase1.PerTeamKeyGeneration(1)] = perTeamKey

		res.newState = TeamSigChainState{
			inner: keybase1.TeamSigChainState{
				Reader:       t.reader,
				Id:           teamID,
				Name:         teamName,
				LastSeqno:    1,
				LastLinkID:   oRes.outerLink.LinkID().Export(),
				ParentID:     nil,
				UserLog:      make(map[keybase1.UserVersion][]keybase1.UserLogPoint),
				PerTeamKeys:  perTeamKeys,
				StubbedTypes: make(map[int]bool),
			}}

		t.updateMembership(&res.newState, roleUpdates, oRes.outerLink.Seqno)

		// check that the signer is an owner
		if res.newState.getUserRole(oRes.signingUser) != keybase1.TeamRole_OWNER {
			return res, fmt.Errorf("signer is not an owner: %v (%v)", oRes.signingUser, team.Members.Owners)
		}

		return res, nil
	case "team.change_membership":
		err = libkb.PickFirstError(
			hasPrevState(true),
			hasName(false),
			hasMembers(true),
			hasParent(false),
			hasSubteam(false))
		if err != nil {
			return res, err
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

		t.updateMembership(&res.newState, roleUpdates, oRes.outerLink.Seqno)

		// Note: If someone was removed, the per-team-key should be rotated. This is not checked though.

		if team.PerTeamKey != nil {
			lastKey, err := prevState.GetLatestPerTeamKey()
			if err != nil {
				return res, fmt.Errorf("getting previous per-team-key: %s", err)
			}
			newKey, err := t.checkPerTeamKey(link, *team.PerTeamKey, lastKey.Gen+keybase1.PerTeamKeyGeneration(1))
			if err != nil {
				return res, err
			}
			res.newState.inner.PerTeamKeys[newKey.Gen] = newKey
		}

		return res, nil
	case "team.rotate_key":
		err = libkb.PickFirstError(
			hasPrevState(true),
			hasName(false),
			hasMembers(false),
			hasParent(false),
			hasSubteam(false),
			hasPerTeamKey(true))
		if err != nil {
			return res, err
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
		newKey, err := t.checkPerTeamKey(link, *team.PerTeamKey, lastKey.Gen+keybase1.PerTeamKeyGeneration(1))
		if err != nil {
			return res, err
		}

		res.newState = prevState.DeepCopy()
		res.newState.inner.PerTeamKeys[newKey.Gen] = newKey

		return res, nil
	case "team.leave":
		err = libkb.PickFirstError(
			hasPrevState(true),
			hasName(false),
			hasMembers(false),
			hasParent(false),
			hasSubteam(false),
			hasPerTeamKey(false))
		if err != nil {
			return res, err
		}

		// Check that the signer is at least a reader.
		// Implicit admins cannot leave a subteam.
		signerRole, err := prevState.GetUserRole(oRes.signingUser)
		if err != nil {
			return res, err
		}
		switch signerRole {
		case keybase1.TeamRole_READER, keybase1.TeamRole_WRITER, keybase1.TeamRole_ADMIN, keybase1.TeamRole_OWNER:
			// ok
		default:
			return res, fmt.Errorf("link signer does not have permission to leave: %v is a %v", oRes.signingUser, signerRole)
		}

		// The last owner of a team should not leave.
		// But that's really up to them and the server. We're just reading what has happened.

		res.newState = prevState.DeepCopy()
		res.newState.inform(oRes.signingUser, keybase1.TeamRole_NONE, oRes.outerLink.Seqno)

		return res, nil
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
	for k, v := range state.inner.StubbedTypes {
		if v {
			k2 := libkb.SigchainV2Type(k)
			if !k2.TeamAllowStub(role) {
				return fmt.Errorf("link stubbed when not allowed allowed; linktype:%v role:%v", k2, role)
			}
		}
	}

	return nil
}

// Check that all the users are formatted correctly.
// Check that there are no duplicate members.
// Do not check that all removals are members. That should be true, but not strictly enforced when reading.
// `firstLink` is whether this is seqno=1. In which case owners must exist. And removals must not exist.
// Rotates to a map which has entries for the roles that actually appeared in the input, even if they are empty lists.
// In other words, if the input has only `admin -> []` then the output will have only `admin` in the map.
func (t *TeamSigChainPlayer) sanityCheckMembers(members SCTeamMembers, firstLink bool) (map[keybase1.TeamRole][]keybase1.UserVersion, error) {
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
		if members.None != nil && len(*members.None) != 0 {
			return nil, fmt.Errorf("team has removals in root link: %+v", members)
		}
	}

	// Map from roles to users.
	res := make(map[keybase1.TeamRole][]keybase1.UserVersion)

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
	if members.None != nil {
		res[keybase1.TeamRole_NONE] = nil
		for _, m := range *members.None {
			all = append(all, assignment{m, keybase1.TeamRole_NONE})
		}
	}

	// Set of users who have already been seen.
	seen := make(map[keybase1.UserVersion]bool)

	for _, pair := range all {
		uv := keybase1.UserVersion(pair.m)

		if seen[uv] {
			return nil, fmt.Errorf("duplicate UID in members: %s", uv.Uid)
		}

		res[pair.role] = append(res[pair.role], uv)

		seen[uv] = true
	}

	return res, nil
}

func (t *TeamSigChainPlayer) checkPerTeamKey(link SCChainLink, perTeamKey SCPerTeamKey, expectedGeneration keybase1.PerTeamKeyGeneration) (res keybase1.PerTeamKey, err error) {
	// check the per-team-key
	if perTeamKey.Generation != expectedGeneration {
		return res, fmt.Errorf("per-team-key generation must start at 1 but got:%d", perTeamKey.Generation)
	}

	// validate signing kid
	sigKey, err := libkb.ImportNaclSigningKeyPairFromHex(perTeamKey.SigKID.String())
	if err != nil {
		return res, fmt.Errorf("invalid per-team-key signing KID: %s", perTeamKey.SigKID)
	}

	// validate encryption kid
	_, err = libkb.ImportNaclDHKeyPairFromHex(perTeamKey.EncKID.String())
	if err != nil {
		return res, fmt.Errorf("invalid per-team-key encryption KID: %s", perTeamKey.EncKID)
	}

	// verify the reverse sig
	// jw is the expected reverse sig contents
	jw, err := jsonw.Unmarshal([]byte(link.Payload))
	if err != nil {
		return res, libkb.NewReverseSigError("per-team-key reverse sig: failed to parse payload: %s", err)
	}
	err = libkb.VerifyReverseSig(t.G(), sigKey, "body.team.per_team_key.reverse_sig", jw, perTeamKey.ReverseSig)
	if err != nil {
		return res, libkb.NewReverseSigError("per-team-key reverse sig: %s", err)
	}

	return keybase1.PerTeamKey{
		Gen:    perTeamKey.Generation,
		Seqno:  link.Seqno,
		SigKID: perTeamKey.SigKID,
		EncKID: perTeamKey.EncKID,
	}, nil
}

// Update `userLog` with the membership in roleUpdates.
// The `NONE` list removes users.
// The other lists add users.
func (t *TeamSigChainPlayer) updateMembership(stateToUpdate *TeamSigChainState, roleUpdates map[keybase1.TeamRole][]keybase1.UserVersion, seqno keybase1.Seqno) {
	for role, uvs := range roleUpdates {
		for _, uv := range uvs {
			stateToUpdate.inform(uv, role, seqno)
		}
	}
}
