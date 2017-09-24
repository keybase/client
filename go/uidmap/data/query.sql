select uid,username from users where concat(substring(sha2(lower(username),256),1,30),'19') != uid order by uid asc
