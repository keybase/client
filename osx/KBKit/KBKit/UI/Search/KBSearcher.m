//
//  KBSearcher.m
//  Keybase
//
//  Created by Gabriel on 4/8/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBSearcher.h"

@interface KBSearcher ()
@property BOOL reloadDelay;
@end

@implementation KBSearcher

- (void)search:(NSString *)query client:(KBRPClient *)client remote:(BOOL)remote completion:(void (^)(NSError *error, KBSearchResults *searchResults))completion {
  if (remote) {
    KBRUserRequest *request = [[KBRUserRequest alloc] initWithClient:client];
    [request searchWithQuery:query completion:^(NSError *error, NSArray *results) {

      NSArray *uids = [results map:^id(KBRSearchResult *sr) { return sr.uid; }];

      KBRUserRequest *loadRequest = [[KBRUserRequest alloc] initWithClient:client];
      [loadRequest loadUncheckedUserSummariesWithUids:uids completion:^(NSError *error, NSArray *userSummaries) {
        KBSearchResults *searchResults = [[KBSearchResults alloc] init];
        searchResults.results = userSummaries;
        searchResults.header = @"keybase.io";
        searchResults.section = 1;
        completion(error, searchResults);
      }];
    }];
  } else {
    KBRUserRequest *request = [[KBRUserRequest alloc] initWithClient:client];
    // TODO: Protocol changed
    /*
    [request listTrackingWithFilter:query completion:^(NSError *error, NSArray *userSummaries) {
      KBSearchResults *searchResults = [[KBSearchResults alloc] init];
      searchResults.results = userSummaries;
      searchResults.header = @"Tracking";
      searchResults.section = 0;
      completion(error, searchResults);
    }];
     */
  }
}

- (void)reloadDelay:(KBTableView *)tableView {
  // Delay the reload so it's not all jankey (buffer reloads)
  _reloadDelay = YES;
  GHWeakSelf gself = self;
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
    if (gself.reloadDelay) {
      [tableView reloadData];
      self.reloadDelay = NO;
    }
  });
}

@end
