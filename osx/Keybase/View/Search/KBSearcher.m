//
//  KBSearcher.m
//  Keybase
//
//  Created by Gabriel on 4/8/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBSearcher.h"

@implementation KBSearcher

- (void)search:(NSString *)query client:(KBRPClient *)client remote:(BOOL)remote completion:(void (^)(NSError *error, KBSearchResults *searchResults))completion {
  if (remote) {
    KBRUserRequest *request = [[KBRUserRequest alloc] initWithClient:client];
    [request searchWithSessionID:request.sessionId query:query completion:^(NSError *error, NSArray *userSummaries) {
      KBSearchResults *searchResults = [[KBSearchResults alloc] init];
      searchResults.results = userSummaries;
      searchResults.header = @"keybase.io";
      searchResults.section = 1;
      completion(error, searchResults);
    }];
  } else {
    KBRUserRequest *request = [[KBRUserRequest alloc] initWithClient:client];
    [request listTrackingWithSessionID:request.sessionId filter:query completion:^(NSError *error, NSArray *userSummaries) {
      KBSearchResults *searchResults = [[KBSearchResults alloc] init];
      searchResults.results = userSummaries;
      searchResults.header = @"Tracking";
      searchResults.section = 0;
      completion(error, searchResults);
    }];
  }
}


@end
