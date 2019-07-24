// Copyright 2019 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"

	"github.com/keybase/client/go/contacts"
	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"

	"golang.org/x/text/unicode/norm"
)

type UserSearchHandler struct {
	libkb.Contextified
	*BaseHandler

	contactsProvider *contacts.CachedContactsProvider
}

func NewUserSearchHandler(xp rpc.Transporter, g *libkb.GlobalContext, provider *contacts.CachedContactsProvider) *UserSearchHandler {
	handler := &UserSearchHandler{
		Contextified:     libkb.NewContextified(g),
		BaseHandler:      NewBaseHandler(g, xp),
		contactsProvider: provider,
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
	// Downcase usernames
	for i, row := range response.List {
		if row.Keybase != nil {
			response.List[i].Keybase.Username = strings.ToLower(row.Keybase.Username)
			response.List[i].RawScore = row.Keybase.RawScore
		}
		if row.Service != nil {
			response.List[i].Service.Username = strings.ToLower(row.Service.Username)
		}
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
	imperfection := 0.5
	score := leadingScore * lengthScore * imperfection
	return true, score
}

var fieldsAndScores = []struct {
	multiplier float64
	plumb      bool // plumb the matched value to displayLabel
	getter     func(*keybase1.ProcessedContact) string
}{
	{1.5, true, func(contact *keybase1.ProcessedContact) string { return contact.ContactName }},
	{1.0, true, func(contact *keybase1.ProcessedContact) string { return contact.Component.ValueString() }},
	{1.0, false, func(contact *keybase1.ProcessedContact) string { return contact.DisplayName }},
	{0.8, false, func(contact *keybase1.ProcessedContact) string { return contact.DisplayLabel }},
	{0.7, false, func(contact *keybase1.ProcessedContact) string { return contact.FullName }},
	{0.7, false, func(contact *keybase1.ProcessedContact) string { return contact.Username }},
}

func matchAndScoreContact(query compiledQuery, contact keybase1.ProcessedContact) (found bool, score float64, plumbMatchedVal string) {
	for _, v := range fieldsAndScores {
		str := v.getter(&contact)
		if str == "" {
			continue
		}
		found, score := query.scoreString(str)
		if found {
			plumbMatchedVal = ""
			if v.plumb {
				plumbMatchedVal = str
			}
			return true, score * v.multiplier, plumbMatchedVal
		}

	}
	return false, 0, ""
}

func contactSearch(mctx libkb.MetaContext, arg keybase1.UserSearchArg) (res []keybase1.APIUserSearchResult, err error) {
	store := mctx.G().SyncedContactList
	contactsRes, err := store.RetrieveContacts(mctx)
	if err != nil {
		return res, err
	}

	query, err := compileQuery(arg.Query)
	if err != nil {
		return res, nil
	}

	for _, c := range contactsRes {
		found, score, matchedVal := matchAndScoreContact(query, c)
		if found {
			contact := c
			if contact.Resolved && matchedVal != "" {
				// If contact is resolved, make sure to plumb matched query to
				// display label. This is not needed for unresolved contacts,
				// which can only match on ContactName or Component Value, and
				// both of them always appear as name and label.
				contact.DisplayLabel = matchedVal
			}
			res = append(res, keybase1.APIUserSearchResult{
				Contact:  &contact,
				RawScore: score,
			})
		}
	}

	return res, nil
}

func imptofuQueryToAssertion(typ keybase1.ImpTofuSearchType, val string) (string, error) {
	switch typ {
	case keybase1.ImpTofuSearchType_PHONE:
		return fmt.Sprintf("%s@phone", keybase1.PhoneNumberToAssertion(val)), nil
	case keybase1.ImpTofuSearchType_EMAIL:
		return fmt.Sprintf("[%s]@email", strings.ToLower(val)), nil
	default:
		return "", errors.New("invalid keybase1.ImpTofuSearchType enum value")
	}
}

func imptofuSearch(mctx libkb.MetaContext, provider contacts.ContactsProvider, imptofuQuery keybase1.ImpTofuQuery) (res *keybase1.APIUserSearchResult, err error) {
	var emails []keybase1.EmailAddress
	var phones []keybase1.RawPhoneNumber

	imptofuType, err := imptofuQuery.T()
	if err != nil {
		return nil, err
	}

	var queryString string

	switch imptofuType {
	case keybase1.ImpTofuSearchType_EMAIL:
		email := imptofuQuery.Email()
		queryString = string(email)
		emails = append(emails, email)
	case keybase1.ImpTofuSearchType_PHONE:
		phone := keybase1.RawPhoneNumber(imptofuQuery.Phone())
		queryString = string(phone)
		phones = append(phones, phone)
	}

	lookupRes, err := provider.LookupAll(mctx, emails, phones, keybase1.RegionCode(""))
	if err != nil {
		return nil, err
	}

	if len(lookupRes) > 0 {
		var uids []keybase1.UID
		for _, v := range lookupRes {
			if v.Error == "" && !v.UID.IsNil() {
				uids = append(uids, v.UID)
			}
		}

		following, err1 := provider.FindFollowing(mctx, uids)
		usernames, err2 := provider.FindUsernames(mctx, uids)
		if err3 := libkb.CombineErrors(err1, err2); err3 != nil {
			mctx.Warning("Cannot find usernames or tracking info for search results: %s", err3)
		}

		for _, v := range lookupRes {
			// Found a resolution
			if v.Error != "" || v.UID.IsNil() {
				continue
			}

			assertionValue := queryString
			if v.Coerced != "" {
				// Server corrected our assertion - take this instead.
				assertionValue = v.Coerced
			}
			assertion, err := imptofuQueryToAssertion(imptofuType, assertionValue)
			if err != nil {
				return nil, err
			}
			imptofu := &keybase1.ImpTofuSearchResult{
				CoercedQuery: assertionValue,
				Resolved:     true,
				Uid:          v.UID,
				Assertion:    assertion,
				Username:     v.UID.String(),
			}
			if following != nil {
				imptofu.Following = following[v.UID]
			}
			if usernames != nil {
				if uname, found := usernames[v.UID]; found {
					imptofu.Username = uname.Username
					imptofu.FullName = uname.Fullname
				}
			}
			res = &keybase1.APIUserSearchResult{
				Score:   1.0,
				Imptofu: imptofu,
			}
			return res, nil // return here - we only want one result
		}
	}

	// Not resolved - add SBS result.
	assertion, err := imptofuQueryToAssertion(imptofuType, queryString)
	if err != nil {
		return nil, err
	}
	imptofu := &keybase1.ImpTofuSearchResult{
		CoercedQuery: queryString,
		Resolved:     false,
		Assertion:    assertion,
	}
	res = &keybase1.APIUserSearchResult{
		Score:   1.0,
		Imptofu: imptofu,
	}
	return res, nil
}

func (h *UserSearchHandler) UserSearch(ctx context.Context, arg keybase1.UserSearchArg) (res []keybase1.APIUserSearchResult, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G()).WithLogTag("USEARCH")
	defer mctx.TraceTimed(fmt.Sprintf("UserSearch#UserSearch(s=%q, q=%q)", arg.Service, arg.Query),
		func() error { return err })()

	if arg.Query == "" {
		return nil, nil
	}

	if !h.G().TestOptions.DisableUserSearchSocialServices {
		if arg.Service != "keybase" && arg.Service != "" {
			// If this is a social search, we just return API results.
			return doSearchRequest(mctx, arg)
		}

		res, err = doSearchRequest(mctx, arg)
		if err != nil {
			mctx.Warning("Failed to do an API search for %q: %s", arg.Service, err)
		}
	}

	if arg.IncludeContacts {
		contactsRes, err := contactSearch(mctx, arg)
		if err != nil {
			mctx.Warning("Failed to do contacts search: %s", err)
		} else {
			res = append(res, contactsRes...)
			// Sort first - we are going to be deduplicating on usernames,
			// entries with higher score have precedence.
			sort.Slice(res, func(i, j int) bool {
				return res[i].RawScore > res[j].RawScore
			})

			// Filter `res` list using `outputRes`.
			usernameSet := make(map[string]struct{}) // set of usernames
			outputRes := make([]keybase1.APIUserSearchResult, 0, len(res))
			for i, v := range res {
				var username string
				if v.Keybase != nil {
					username = v.Keybase.Username
				} else if v.Contact != nil && v.Contact.Resolved {
					username = v.Contact.Username
				}
				if username != "" {
					// Only deduplicate resolved contacts or keybase users.
					if _, found := usernameSet[username]; found {
						continue
					}
					usernameSet[username] = struct{}{}
				}
				v.Score = 1.0 / float64(1+i)
				outputRes = append(outputRes, v)
			}
			res = outputRes

			// Trim the whole result to MaxResult.
			maxRes := arg.MaxResults
			if maxRes > 0 && len(res) > maxRes {
				res = res[:maxRes]
			}
		}
	}

	if arg.ImpTofuQuery != nil {
		imptofuRes, err := imptofuSearch(mctx, h.contactsProvider, *arg.ImpTofuQuery)
		if err != nil {
			mctx.Error("Failed to do phone number / email search: %s", err)
		} else if imptofuRes != nil {
			// Check if we have found assertion of this result already in our
			// contacts.
			var found bool
			for _, v := range res {
				if v.Contact != nil && v.Contact.Assertion == imptofuRes.Imptofu.Assertion {
					found = true
					break
				}
			}

			if !found {
				// Prepend *imptofuRes
				res = append([]keybase1.APIUserSearchResult{*imptofuRes}, res...)
			}
		}
	}

	maxRes := arg.MaxResults
	if maxRes > 0 && len(res) > maxRes {
		res = res[:maxRes]
	}

	return res, nil
}

func (h *UserSearchHandler) GetNonUserDetails(ctx context.Context, arg keybase1.GetNonUserDetailsArg) (res keybase1.NonUserDetails, err error) {
	mctx := libkb.NewMetaContext(ctx, h.G())
	defer mctx.TraceTimed(fmt.Sprintf("UserSearch#GetNonUserDetails(%q)", arg.Assertion),
		func() error { return err })()

	actx := mctx.G().MakeAssertionContext(mctx)
	url, err := libkb.ParseAssertionURL(actx, arg.Assertion, true /* strict */)
	if err != nil {
		return res, err
	}

	username := url.GetValue()
	service := url.GetKey()
	res.AssertionValue = username
	res.AssertionKey = service

	if url.IsKeybase() {
		res.IsNonUser = false
		res.Description = "Keybase user"
		return res, nil
	}

	res.IsNonUser = true
	assertion := url.String()

	if url.IsSocial() {
		res.Description = fmt.Sprintf("%s user", strings.Title(service))
		apiRes, err := doSearchRequest(mctx, keybase1.UserSearchArg{
			Query:                  username,
			Service:                service,
			IncludeServicesSummary: false,
			MaxResults:             1,
		})
		if err == nil {
			for _, v := range apiRes {
				s := v.Service
				if s != nil && strings.ToLower(s.Username) == strings.ToLower(username) && string(s.ServiceName) == service {
					res.Service = s
				}
			}
		} else {
			mctx.Warning("Can't get external profile data with: %s", err)
		}

		res.SiteIcon = externals.MakeIcons(mctx, service, "logo_black", 16)
		res.SiteIconFull = externals.MakeIcons(mctx, service, "logo_full", 64)
	} else if service == "phone" || service == "email" {
		contacts, err := mctx.G().SyncedContactList.RetrieveContacts(mctx)
		if err == nil {
			for _, v := range contacts {
				if v.Assertion == assertion {
					contact := v
					res.Contact = &contact
					break
				}
			}
		} else {
			mctx.Warning("Can't get contact list to match assertion: %s", err)
		}

		switch service {
		case "phone":
			res.Description = "Phone contact"
		case "email":
			res.Description = "E-mail contact"
		}
	}

	return res, nil
}
