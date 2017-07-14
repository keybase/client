package teams

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func RenameSubteam(ctx context.Context, g *libkb.GlobalContext, prevName keybase1.TeamName, newNameLastPart string) error {
	g.Log.CDebugf(ctx, "RenameSubteam")

	if prevName.IsRootTeam() {
		return fmt.Errorf("cannot rename root team: %s", prevName.String())
	}
	parentName, err := prevName.Parent()
	if err != nil {
		return err
	}
	newName, err := prevName.SwapLastPart(newNameLastPart)
	if err != nil {
		return err
	}
	g.Log.CDebugf(ctx, "RenameSubteam %v -> %v", prevName, newName)

	g.Log.CDebugf(ctx, "RenameSubteam load teams: parent:'%v' subteam:'%v'",
		parentName.String(), prevName.String())
	parent, err := GetForTeamManagementByStringName(ctx, g, parentName.String(), true)
	if err != nil {
		return err
	}
	subteam, err := GetForTeamManagementByStringName(ctx, g, prevName.String(), false)
	if err != nil {
		return err
	}

	g.Log.CDebugf(ctx, "RenameSubteam load me")
	me, err := libkb.LoadMe(libkb.NewLoadUserArg(g))
	if err != nil {
		return err
	}
	parent.me = me
	subteam.me = me

	deviceSigningKey, err := g.ActiveDevice.SigningKey()
	if err != nil {
		return err
	}

	admin, err := parent.getAdminPermission(ctx, true)

	err = parent.ForceMerkleRootUpdate(ctx)
	if err != nil {
		return err
	}

	// Subteam renaming involves two links, one `rename_subteam` in the parent
	// team's chain, and one `rename_up_pointer` in the subteam's chain.

	g.Log.CDebugf(ctx, "RenameSubteam make sigs")
	renameSubteamSig, err := generateRenameSubteamSigForParentChain(
		g, me, deviceSigningKey, parent.chain(), subteam.ID, newName, admin)
	if err != nil {
		return err
	}

	renameUpPointerSig, err := generateRenameUpPointerSigForSubteamChain(
		g, me, deviceSigningKey, chainPair{parent: parent.chain(), subteam: subteam.chain()}, newName, admin)
	if err != nil {
		return err
	}

	payload := make(libkb.JSONPayload)
	payload["sigs"] = []interface{}{renameSubteamSig, renameUpPointerSig}

	g.Log.CDebugf(ctx, "RenameSubteam post")
	_, err = g.API.PostJSON(libkb.APIArg{
		Endpoint:    "sig/multi",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	})
	if err != nil {
		return err
	}

	go g.GetTeamLoader().NotifyTeamRename(ctx, subteam.ID, newName.String())

	return nil
}

func generateRenameSubteamSigForParentChain(g *libkb.GlobalContext, me *libkb.User, signingKey libkb.GenericKey, parentTeam *TeamSigChainState, subteamID keybase1.TeamID, newSubteamName keybase1.TeamName, admin *SCTeamAdmin) (item *libkb.SigMultiItem, err error) {
	teamSection := SCTeamSection{
		Admin: admin,
		ID:    (SCTeamID)(parentTeam.GetID()),
		Subteam: &SCSubteam{
			ID:   (SCTeamID)(subteamID),
			Name: (SCTeamName)(newSubteamName.String()),
		},
	}

	sigBody, err := RenameSubteamSig(me, signingKey, parentTeam, teamSection)
	if err != nil {
		return nil, err
	}
	sigJSON, err := sigBody.Marshal()
	if err != nil {
		return nil, err
	}

	prevLinkID, err := libkb.ImportLinkID(parentTeam.GetLatestLinkID())
	if err != nil {
		return nil, err
	}
	v2Sig, err := makeSigchainV2OuterSig(
		signingKey,
		libkb.LinkTypeRenameSubteam,
		parentTeam.GetLatestSeqno()+1,
		sigJSON,
		prevLinkID,
		false, /* hasRevokes */
	)
	if err != nil {
		return nil, err
	}

	item = &libkb.SigMultiItem{
		Sig:        v2Sig,
		SigningKID: signingKey.GetKID(),
		Type:       string(libkb.LinkTypeRenameSubteam),
		SigInner:   string(sigJSON),
		TeamID:     parentTeam.GetID(),
	}
	return item, nil
}

type chainPair struct {
	parent  *TeamSigChainState
	subteam *TeamSigChainState
}

func generateRenameUpPointerSigForSubteamChain(g *libkb.GlobalContext, me *libkb.User, signingKey libkb.GenericKey, teams chainPair, newSubteamName keybase1.TeamName, admin *SCTeamAdmin) (item *libkb.SigMultiItem, err error) {
	newSubteamNameStr := newSubteamName.String()
	teamSection := SCTeamSection{
		Admin: admin,
		ID:    (SCTeamID)(teams.subteam.GetID()),
		Name:  (*SCTeamName)(&newSubteamNameStr),
		Parent: &SCTeamParent{
			ID:      SCTeamID(teams.parent.GetID()),
			Seqno:   teams.parent.GetLatestSeqno() + 1, // the seqno of the *new* parent link
			SeqType: keybase1.SeqType_SEMIPRIVATE,
		},
	}

	sigBody, err := RenameUpPointerSig(me, signingKey, teams.subteam, teamSection)
	if err != nil {
		return nil, err
	}
	sigJSON, err := sigBody.Marshal()
	if err != nil {
		return nil, err
	}

	prevLinkID, err := libkb.ImportLinkID(teams.subteam.GetLatestLinkID())
	if err != nil {
		return nil, err
	}
	v2Sig, err := makeSigchainV2OuterSig(
		signingKey,
		libkb.LinkTypeRenameUpPointer,
		teams.subteam.GetLatestSeqno()+1,
		sigJSON,
		prevLinkID,
		false, /* hasRevokes */
	)
	if err != nil {
		return nil, err
	}

	item = &libkb.SigMultiItem{
		Sig:        v2Sig,
		SigningKID: signingKey.GetKID(),
		Type:       string(libkb.LinkTypeRenameUpPointer),
		SigInner:   string(sigJSON),
		TeamID:     teams.subteam.GetID(),
	}
	return item, nil
}
