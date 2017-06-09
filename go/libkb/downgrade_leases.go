// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package libkb

import (
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	context "golang.org/x/net/context"
	"strings"
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

func leaseWithMerkleRoot(ctx context.Context, g *GlobalContext, res leaseReply) (lease *Lease, mr *MerkleRoot, err error) {
	mr, err = g.MerkleClient.FetchRootFromServerBySeqno(ctx, res.Lease.MerkleSeqno)
	if err != nil {
		return nil, nil, err
	}
	return &res.Lease, mr, nil
}
