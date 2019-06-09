- [ ] check seeds in FTL and slow load
- [ ] back track hidden chain load to where it's first pinned
- [x] test case that works for hidden rotation
- [ ] test case where alice and bob rotate the team and they each take turns
- [ ] precheck that a link will be accepted by the server (as does chain3)
- [ ] try to figure out refreshing and cache-bust store for chain17
  - idea: merkle/path.json:
    - you're allowed to know if there's something bigger than a given linkID, without explicitly checking membership:
    - select 1 from sig3_team where (team_id,seqno)=(select team_id,seqno+1 from sig3_team where link_id='1YRrMgK+VkhvG/owg+iwYoGLmHGuBlQkObn9Yz0Xvlo');
  
