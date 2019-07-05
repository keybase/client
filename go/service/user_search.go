// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"fmt"
	"regexp"
	"sort"
	"strings"

	"github.com/keybase/client/go/contacts"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"

	"golang.org/x/text/unicode/norm"
)

type UserSearchHandler struct {
	libkb.Contextified
	*BaseHandler
	savedContacts *contacts.SavedContactsStore
}

func NewUserSearchHandler(xp rpc.Transporter, g *libkb.GlobalContext, pbs *contacts.SavedContactsStore) *UserSearchHandler {
	handler := &UserSearchHandler{
		Contextified:  libkb.NewContextified(g),
		BaseHandler:   NewBaseHandler(g, xp),
		savedContacts: pbs,
	}
	return handler
}

var _ keybase1.UserSearchInterface = (*UserSearchHandler)(nil)

type rawSearchResults struct {
	libkb.AppStatusEmbed
	List []keybase1.APIUserSearchResult `json:"list"`
}

func doSearchRequest(mctx libkb.MetaContext, arg keybase1.UserSearchArg) (res []keybase1.APIUserSearchResult, err error) {
	service := arg.Service
	if service == "keybase" {
		service = ""
	}
	apiArg := libkb.APIArg{
		Endpoint:    "user/user_search",
		SessionType: libkb.APISessionTypeNONE,
		Args: libkb.HTTPArgs{
			"q":                        libkb.S{Val: arg.Query},
			"num_wanted":               libkb.I{Val: arg.MaxResults},
			"service":                  libkb.S{Val: service},
			"include_services_summary": libkb.B{Val: arg.IncludeServicesSummary},
		},
	}
	var response rawSearchResults
	err = mctx.G().API.GetDecode(mctx, apiArg, &response)
	if err != nil {
		return nil, err
	}
	return response.List, nil
}

func normalizeText(str string) string {
	return strings.ToLower(string(norm.NFKD.Bytes([]byte(str))))
}

var splitRxx = regexp.MustCompile(`[-\s!$%^&*()_+|~=` + "`" + `{}\[\]:";'<>?,.\/]+`)

func queryToRegexp(q string) (*regexp.Regexp, error) {
	parts := splitRxx.Split(q, -1)
	nonEmptyParts := make([]string, 0, len(parts))
	for _, p := range parts {
		if p != "" {
			nonEmptyParts = append(nonEmptyParts, p)
		}
	}
	rxx, err := regexp.Compile(".*" + strings.Join(nonEmptyParts, ".*") + ".*")
	if err != nil {
		return nil, err
	}
	rxx.Longest()
	return rxx, nil
}

type compiledQuery struct {
	query string
	rxx   *regexp.Regexp
}

func compileQuery(query string) (res compiledQuery, err error) {
	query = normalizeText(query)
	rxx, err := queryToRegexp(query)
	if err != nil {
		return res, err
	}
	res = compiledQuery{
		query: query,
		rxx:   rxx,
	}
	return res, nil
}

func (q *compiledQuery) scoreString(str string) (bool, float64) {
	norm := normalizeText(str)
	if norm == q.query {
		return true, 1
	}

	index := q.rxx.FindStringIndex(norm)
	if index == nil {
		return false, 0
	}

	leadingScore := 1.0 / float64(1+index[0])
	lengthScore := 1.0 / float64(1+len(norm))
	imperfection := 0.1
	score := leadingScore * lengthScore * imperfection
	return true, score
}

func matchAndScoreContact(query compiledQuery, contact keybase1.ProcessedContact) (bool, float64) {
	found, score := query.scoreString(contact.DisplayName)
	if found {
		return true, score
	}
	found, score = query.scoreString(contact.DisplayLabel)
	if found {
		return true, score * 0.8
	}
	return false, 0
}

func contactSearch(mctx libkb.MetaContext, store *contacts.SavedContactsStore, arg keybase1.UserSearchArg) (res []keybase1.APIUserSearchResult, err error) {
	contactsRes, err := store.RetrieveContacts(mctx)
	if err != nil {
		return res, err
	}

	query, err := compileQuery(arg.Query)
	if err != nil {
		return res, nil
	}

	for _, c := range contactsRes {
		found, score := matchAndScoreContact(query, c)
		if found {
			contact := c
			res = append(res, keybase1.APIUserSearchResult{
				Score:   score,
				Contact: &contact,
			})
		}
	}

	sort.Slice(res, func(i, j int) bool {
		return res[i].Score > res[j].Score
	})
	for i := range res {
		res[i].Score = 1.0 / float64(1+i)
	}

	return res, nil
}

func (h *UserSearchHandler) UserSearch(ctx context.Context, arg keybase1.UserSearchArg) (res []keybase1.APIUserSearchResult, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("USEARCH")
	defer mctx.TraceTimed(fmt.Sprintf("UserSearch#UserSearch(s=%q, q=%q)", arg.Service, arg.Query),
		func() error { return err })()

	if arg.Query == "" {
		return res, nil
	}

	res, err = doSearchRequest(mctx, arg)
	if arg.IncludeContacts {
		contactsRes, err := contactSearch(mctx, h.savedContacts, arg)
		switch err.(type) {
		case nil, contacts.NoSavedContactsErr:
		default:
			return res, err
		}

		if len(contactsRes) > 0 {
			var res2 []keybase1.APIUserSearchResult
			res2 = append(res2, contactsRes...)
			res2 = append(res2, res...)
			res = res2

			maxRes := arg.MaxResults
			if maxRes > 0 && len(res) > maxRes {
				res = res[:maxRes]
			}
		}
	}

	return res, nil
}
