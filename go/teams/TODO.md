# This PR
- [x] back track hidden chain load to where it's first pinned
  - we had this but @mlsteele talked us out of it, so just error in that case too, server should not have lied
  - maybe we should have server sign these things and we cache it, so client can prove server lied?
- [x] test case that works for hidden rotation
- [ ] test case where alice and bob rotate the team and they each take turns
- [ ] precheck that a link will be accepted by the server (as does chain3)
  - [ ] future ticket
- [ ] feature-flag this for almost everything except for blessed prod teams (by team ID) (server + client)
  - [ ] prod disallowed in this PR
  - [ ] future tickets for allowing some teams to use new features on prod
- [x] alert in laoder2.go / addSecrets -- add back later
- [x] in Advance() we should still check prevs
  - [x] thought more about this, and it's not needed, but it can't hurt
- [ ] fix addSecrets to take a Teamer
- [ ] proprer fix (with vendoring) for test vector
- [x] try to figure out refreshing and cache-bust store for chain17
  - idea: merkle/path.json:
    - you're allowed to know if there's something bigger than a given linkID, without explicitly checking membership:
    - select 1 from sig3_team where (team_id,seqno)=(select team_id,seqno+1 from sig3_team where link_id='1YRrMgK+VkhvG/owg+iwYoGLmHGuBlQkObn9Yz0Xvlo');

# Future PRs
- [ ] check seeds in FTL and slow load