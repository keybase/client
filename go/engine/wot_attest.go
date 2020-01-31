// Copyright 2020 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	jsonw "github.com/keybase/go-jsonw"
)

type WotAttestArg struct {
	AttesteeUID  keybase1.UID
	Attestations []string
}

// WotAttest is an engine.
type WotAttest struct {
	arg *WotAttestArg
	libkb.Contextified
}

// NewWotAttest creates a WotAttest engine.
func NewWotAttest(g *libkb.GlobalContext, arg *WotAttestArg) *WotAttest {
	return &WotAttest{
		arg:          arg,
		Contextified: libkb.NewContextified(g),
	}
}

// Name is the unique engine name.
func (e *WotAttest) Name() string {
	return "WotAttest"
}

// GetPrereqs returns the engine prereqs.
func (e *WotAttest) Prereqs() Prereqs {
	return Prereqs{Device: true}
}

// RequiredUIs returns the required UIs.
func (e *WotAttest) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{}
}

// SubConsumers returns the other UI consumers for this engine.
func (e *WotAttest) SubConsumers() []libkb.UIConsumer {
	return nil
}

/*
type attestUser struct {
	Username string       `json:"username"`
	UID      keybase1.UID `json:"uid"`
	Eldest   struct {
		KID   keybase1.KID   `json:"kid"`
		Seqno keybase1.Seqno `json:"seqno"`
	}
	SeqTail
}

type attest struct {
	User        attestUser `json:"user"`
	Confidence  confidence `json:"confidence"`
	Attestation []string   `json:"attestation"`
}
*/

// Run starts the engine.
func (e *WotAttest) Run(mctx libkb.MetaContext) error {

	luArg := libkb.NewLoadUserArgWithMetaContext(mctx).WithUID(e.arg.AttesteeUID)
	them, err := libkb.LoadUser(luArg)
	if err != nil {
		return err
	}
	statement := jsonw.NewDictionary()
	statement.SetKey("user", them.ToWotStatement())
	statement.SetKey("attestations", libkb.JsonwStringArray(e.arg.Attestations))

	attest := jsonw.NewDictionary()
	attest.SetKey("obj", statement)
	randKey, err := libkb.RandBytes(16)
	if err != nil {
		return err
	}
	hexKey := hex.EncodeToString(randKey)
	attest.SetKey("key", jsonw.NewString(hexKey))

	marshaled, err := statement.Marshal()
	if err != nil {
		return err
	}
	mctx.Debug("\n\n\nattest statement: %s\n\n\n", marshaled)

	mac := hmac.New(sha256.New, randKey)
	mac.Write(marshaled)
	sum := mac.Sum(nil)
	mctx.Debug("\n\n\nhmac: %x\n\n\n", sum)

	expansions := jsonw.NewDictionary()
	expansions.SetKey(hex.EncodeToString(sum), attest)
	em, err := expansions.Marshal()
	if err != nil {
		return err
	}
	mctx.Debug("\n\n\nexpansions: %s\n\n\n", em)

	signingKey, err := mctx.G().ActiveDevice.SigningKey()
	if err != nil {
		return err
	}

	me, err := libkb.LoadMe(libkb.NewLoadUserArgWithMetaContext(mctx).WithForceReload())
	if err != nil {
		return err
	}
	sigVersion := libkb.KeybaseSignatureV2
	proof, err := me.WotAttestProof(mctx, signingKey, sigVersion, sum)
	if err != nil {
		return err
	}
	inner, err := proof.J.Marshal()
	if err != nil {
		return err
	}

	mctx.Debug("proof inner %s", inner)

	sig, sigID, linkID, err := libkb.MakeSig(
		mctx,
		signingKey,
		libkb.LinkTypeWotAttest,
		inner,
		libkb.SigHasRevokes(false),
		keybase1.SeqType_PUBLIC,
		libkb.SigIgnoreIfUnsupported(true),
		me,
		sigVersion,
	)

	mctx.Debug("sig: %s", sig)
	mctx.Debug("sigID: %s", sigID)
	mctx.Debug("linkID: %s", linkID)

	item := libkb.SigMultiItem{
		Sig:        sig,
		SigningKID: signingKey.GetKID(),
		Type:       string(libkb.LinkTypeWotAttest),
		SeqType:    keybase1.SeqType_PUBLIC,
		SigInner:   string(inner),
		Version:    sigVersion,
		Expansions: expansions,
	}

	payload := make(libkb.JSONPayload)
	payload["sigs"] = []interface{}{item}

	jsonString, err := json.MarshalIndent(payload, "", "    ")
	if err != nil {
		return err
	}
	mctx.Debug("payload: %s", jsonString)
	/*
	    {
	      "sig": "g6Rib2R5hqhkZXRhY2hlZMOpaGFzaF90eXBlCqNrZXnEIwEgt7UOBy2HiyI/sj22HcMBjV7E4cdkxW6aBEBZFX+EMcoKp3BheWxvYWTEbZkCBcQglfwWIM+PJxcafGyesE5ADgxbUDCF+nX/EBVFj/Q81ObEIFCKfdt+/w/WdlzjuLoYAWRUbv5sIBrrDCi30zKmlXFQEAHCAcQgJQlXcH2brsBa+/aYZYaursDz0TrrRQzsXd2Y8/eNbZejc2lnxECvOq/z4n7Vckrl/2+sa7H/o/sIBH9lOgIzxAciOnQXjNt5uPZLsfMQ2ryNOHtLpd9KkVOWdXA2jSaLEoKq/ocJqHNpZ190eXBlIKN0YWfNAgKndmVyc2lvbgE=",
	      "sig_inner": "{\"body\":{\"key\":{\"eldest_kid\":\"0120b7b50e072d878b223fb23db61dc3018d5ec4e1c764c56e9a044059157f8431ca0a\",\"host\":\"keybase.io\",\"kid\":\"0120b7b50e072d878b223fb23db61dc3018d5ec4e1c764c56e9a044059157f8431ca0a\",\"uid\":\"58d0a220bda99fea6ef7f8ff70491419\",\"username\":\"ba2b2cc7f\"},\"type\":\"wot.attest\",\"version\":2,\"wot_attest\":\"76aafa2585ebfb51aebd5e7f024808f08b4626adc544f425730ce4b5b0fc7b43\"},\"ctime\":1579204570,\"expire_in\":157680000,\"high_skip\":{\"hash\":\"250957707d9baec05afbf6986586aeaec0f3d13aeb450cec5ddd98f3f78d6d97\",\"seqno\":1},\"prev\":\"95fc1620cf8f27171a7c6c9eb04e400e0c5b503085fa75ff1015458ff43cd4e6\",\"seq_type\":1,\"seqno\":5,\"tag\":\"signature\"}",
	      "expansions": {
	        "76aafa2585ebfb51aebd5e7f024808f08b4626adc544f425730ce4b5b0fc7b43": {
	          "obj": {
	            "user": {
	              "username": "a9a64bf08",
	              "uid": "b4009680dc87511754605d1d188bb019",
	              "eldest": {
	                "kid": "01202ac5bee86776b216446d8829465134c2c2fdbbe480a9a4bfb3ec360ac1ba5d300a",
	                "seqno": 1
	              },
	              "seq_tail": {
	                "seqno": 4,
	                "payload_hash": "fd2ded8d5c6573cfeda9f275c9bb9fdbef477d1df57027f5f676e3c85a9df702",
	                "sig_id": "6368f64a9cdf4e22cf76b8561b385b2147f1ec71f2709e2174fc18b792ebde390f"
	              }
	            },
	            "confidence": {
	              "username_verified_via": "audio"
	            },
	            "attestation": [
	              "biz bar bam"
	            ]
	          },
	          "key": "25e1e60907fdac32d2f8707321ed3c7d"
	        }
	      },
	      "type": "wot.attest",
	      "signing_kid": "0120b7b50e072d878b223fb23db61dc3018d5ec4e1c764c56e9a044059157f8431ca0a"
	    }
	  ]`
	*/

	_, err = e.G().API.PostJSON(mctx, libkb.APIArg{
		Endpoint:    "sig/multi",
		SessionType: libkb.APISessionTypeREQUIRED,
		JSONPayload: payload,
	})
	return err
}
