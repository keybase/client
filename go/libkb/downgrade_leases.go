// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	"strings"

	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
)

func kidsToString(kids []keybase1.KID) string {
	var tmp []string
	for _, k := range kids {
		tmp = append(tmp, string(k))
	}
	return strings.Join(tmp, ",")
}

func sigIDsToString(sigIDs []keybase1.SigID) string {
	var tmp []string
	for _, k := range sigIDs {
		tmp = append(tmp, string(k))
	}
	return strings.Join(tmp, ",")
}

func UidsToString(uids []keybase1.UID) string {
	s := make([]string, len(uids))
	for i, uid := range uids {
		s[i] = string(uid)
	}
	return strings.Join(s, ",")
}

type Lease struct {
	MerkleSeqno keybase1.Seqno    `json:"merkle_seqno"`
	LeaseID     keybase1.LeaseID  `json:"downgrade_lease_id"`
	HashMeta    keybase1.HashMeta `json:"hash_meta"`
}

type leaseReply struct {
	Lease
	Status AppStatus `json:"status"`
}

func (r *leaseReply) GetAppStatus() *AppStatus {
	return &r.Status
}

func RequestDowngradeLeaseByKID(ctx context.Context, g *GlobalContext, kids []keybase1.KID) (lease *Lease, mr *MerkleRoot, err error) {
	var res leaseReply
	err = g.API.PostDecode(APIArg{
		Endpoint:    "downgrade/key",
		SessionType: APISessionTypeREQUIRED,
		NetContext:  ctx,
		Args: HTTPArgs{
			"kids": S{kidsToString(kids)},
		},
	}, &res)
	if err != nil {
		return nil, nil, err
	}
	return leaseWithMerkleRoot(ctx, g, res)
}

func CancelDowngradeLease(ctx context.Context, g *GlobalContext, l keybase1.LeaseID) error {
	_, err := g.API.Post(APIArg{
		Endpoint:    "downgrade/cancel",
		SessionType: APISessionTypeREQUIRED,
		NetContext:  ctx,
		Args: HTTPArgs{
			"downgrade_lease_id": S{string(l)},
		},
	})
	return err
}

func RequestDowngradeLeaseBySigIDs(ctx context.Context, g *GlobalContext, sigIDs []keybase1.SigID) (lease *Lease, mr *MerkleRoot, err error) {
	var res leaseReply
	err = g.API.PostDecode(APIArg{
		Endpoint:    "downgrade/sig",
		SessionType: APISessionTypeREQUIRED,
		NetContext:  ctx,
		Args: HTTPArgs{
			"sig_ids": S{sigIDsToString(sigIDs)},
		},
	}, &res)
	if err != nil {
		return nil, nil, err
	}
	return leaseWithMerkleRoot(ctx, g, res)
}

func RequestDowngradeLeaseByTeam(ctx context.Context, g *GlobalContext, teamID keybase1.TeamID, uids []keybase1.UID) (lease *Lease, mr *MerkleRoot, err error) {
	var res leaseReply
	err = g.API.PostDecode(APIArg{
		Endpoint:    "downgrade/team",
		SessionType: APISessionTypeREQUIRED,
		NetContext:  ctx,
		Args: HTTPArgs{
			"team_id":     S{string(teamID)},
			"member_uids": S{UidsToString(uids)},
		},
	}, &res)
	if err != nil {
		return nil, nil, err
	}
	return leaseWithMerkleRoot(ctx, g, res)
}

func leaseWithMerkleRoot(ctx context.Context, g *GlobalContext, res leaseReply) (lease *Lease, mr *MerkleRoot, err error) {
	mr, err = g.MerkleClient.FetchRootFromServerBySeqno(NewMetaContext(ctx, g), res.Lease.MerkleSeqno)
	if err != nil {
		return nil, nil, err
	}
	return &res.Lease, mr, nil
}
