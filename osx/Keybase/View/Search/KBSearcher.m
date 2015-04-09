//
//  KBSearcher.m
//  Keybase
//
//  Created by Gabriel on 4/8/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBSearcher.h"

@implementation KBSearcher

KBRUserSummary *KBUserSummaryFromSearchResult(KBSearchResult *searchResult) {
  KBRUserSummary *userSummary = [[KBRUserSummary alloc] init];
  userSummary.username = searchResult.userName;
  userSummary.uid = [KBRUtils UIDFromHexString:searchResult.userId];
  userSummary.fullName = searchResult.fullName;
  return userSummary;
}

- (void)search:(NSString *)query client:(KBRPClient *)client remote:(BOOL)remote completion:(void (^)(NSError *error, KBSearchResults *searchResults))completion {
  if (remote) {
    [AppDelegate.sharedDelegate.APIClient searchUsersWithQuery:query success:^(NSArray *results) {
      NSArray *userSummaries = [results map:^(KBSearchResult *sr) { return KBUserSummaryFromSearchResult(sr); }];

      KBSearchResults *searchResults = [[KBSearchResults alloc] init];
      searchResults.results = userSummaries;
      searchResults.header = @"keybase.io";
      searchResults.section = 1;

      completion(nil, searchResults);
    } failure:^(NSError *error) {
      completion(error, nil);
    }];
  } else {
    KBRUserRequest *request = [[KBRUserRequest alloc] initWithClient:client];
    [request listTrackingWithFilter:query completion:^(NSError *error, NSArray *userSummaries) {
      KBSearchResults *searchResults = [[KBSearchResults alloc] init];
      searchResults.results = userSummaries;
      searchResults.header = @"Tracking";
      searchResults.section = 0;
      completion(error, searchResults);
    }];
  }
}


@end
