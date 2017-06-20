package service

import (
	"context"
	"sort"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type rankedList struct {
	uids  []keybase1.UID
	ranks map[string]int
}

func newRankedList(uids []keybase1.UID) *rankedList {
	r := &rankedList{
		uids:  uids,
		ranks: make(map[string]int),
	}
	for index, uid := range uids {
		r.ranks[uid.String()] = index
	}
	return r
}

func (r *rankedList) UIDs() []keybase1.UID {
	return r.uids
}

func (r *rankedList) Rank(uid keybase1.UID) float64 {
	var index int
	var ok bool
	if index, ok = r.ranks[uid.String()]; !ok {
		return 0
	}

	total := float64(len(r.uids))
	return ((total - float64(index)) / total)
}

type weightedRankedList struct {
	*rankedList
	weight float64
}

func newWeightedRankedList(rl *rankedList, weight float64) *weightedRankedList {
	return &weightedRankedList{
		rankedList: rl,
		weight:     weight,
	}
}

func (w *weightedRankedList) Weight() float64 {
	return w.weight
}

type linearWeightedSelector struct {
	libkb.Contextified
	lists []*weightedRankedList
}

func newLinearWeightedSelector(g *libkb.GlobalContext, lists []*weightedRankedList) *linearWeightedSelector {
	return &linearWeightedSelector{
		Contextified: libkb.NewContextified(g),
		lists:        lists,
	}
}

func (w *linearWeightedSelector) getAllUIDs() (res []keybase1.UID) {
	m := make(map[string]bool)
	for _, list := range w.lists {
		uids := list.UIDs()
		for _, uid := range uids {
			m[uid.String()] = true
		}
	}
	for uid := range m {
		res = append(res, keybase1.UID(uid))
	}
	return res
}

func (w *linearWeightedSelector) Select() (res []keybase1.UID) {
	type userScore struct {
		uid   keybase1.UID
		score float64
	}
	var scores []userScore
	for _, uid := range w.getAllUIDs() {
		total := 0.0
		// Get score in each list to get a total score
		for _, list := range w.lists {
			total += list.Rank(uid) * list.Weight()
		}
		scores = append(scores, userScore{
			uid:   uid,
			score: total,
		})
	}

	sort.Slice(scores, func(i, j int) bool { return scores[i].score > scores[j].score })
	for _, score := range scores {
		res = append(res, score.uid)
	}
	return res
}

type interestingPeopleFn func(uid keybase1.UID) ([]keybase1.UID, error)

type interestingPeopleSource struct {
	fn     interestingPeopleFn
	weight float64
}

type interestingPeople struct {
	libkb.Contextified
	sources []interestingPeopleSource
}

func newInterestingPeople(g *libkb.GlobalContext) *interestingPeople {
	return &interestingPeople{
		Contextified: libkb.NewContextified(g),
	}
}

func (i *interestingPeople) AddSource(fn interestingPeopleFn, weight float64) {
	i.sources = append(i.sources, interestingPeopleSource{
		fn:     fn,
		weight: weight,
	})
}

func (i interestingPeople) Get(ctx context.Context) ([]keybase1.UID, error) {
	uid := i.G().Env.GetUID()
	if uid.IsNil() {
		return nil, libkb.LoginRequiredError{}
	}

	var weightedLists []*weightedRankedList
	for _, source := range i.sources {
		ppl, err := source.fn(uid)
		if err != nil {
			i.G().Log.Debug("interestingPeople: failed to get list from source: %s", err.Error())
			return nil, err
		}
		weightedLists = append(weightedLists, newWeightedRankedList(newRankedList(ppl), source.weight))
	}

	return newLinearWeightedSelector(i.G(), weightedLists).Select(), nil
}
