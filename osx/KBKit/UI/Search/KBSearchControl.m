//
//  KBSearchControl.m
//  Keybase
//
//  Created by Gabriel on 3/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBSearchControl.h"
#import "KBDefines.h"

@interface KBSearchControl ()
@property NSString *searchText;
@property BOOL open;
@end

@implementation KBSearchControl

- (void)textDidChange:(NSString *)text {
  [self search:text];

  if ([text isEqualTo:@""] && _open) {
    [self.delegate searchControlShouldClose:self];
    _open = NO;
  } else {
    [self checkOpen];
  }
}

- (void)setSearchResults:(KBSearchResults *)searchResults {
  [self.delegate searchControl:self shouldDisplaySearchResults:searchResults];
}

- (void)clearSearchResults {
  [self.delegate searchControlShouldClearSearchResults:self];
}

- (void)search:(NSString *)searchText {
  _searchText = searchText;
  [self _search:searchText];
}

- (void)checkOpen {
  if (!_open) {
    [self.delegate searchControlShouldOpen:self];
    _open = YES;
  }
}

- (void)_search:(NSString *)searchText {
  GHWeakSelf blockSelf = self;
  _searchText = searchText;

  if (!searchText || [searchText length] < 1) { // If you want to make min length for search change 1 here to N
    [self clearSearchResults];
    [self.delegate searchControl:self progressEnabled:NO];
    return;
  }

  [self.delegate searchControl:self progressEnabled:YES];

  [self clearSearchResults];
  [blockSelf _search:searchText delay:NO];
  // TODO: We assume local search will never take > 700ms
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 700 * NSEC_PER_MSEC), dispatch_get_main_queue(), ^{
    if ([blockSelf.searchText isEqual:searchText]) {
      [blockSelf _search:searchText delay:YES];
    }
  });
}

- (void)_search:(NSString *)searchText delay:(BOOL)delay {
  _searchText = searchText;

  [self.delegate searchControl:self progressEnabled:YES];

  GHWeakSelf gself = self;
  DDLogDebug(@"Search (delay=%@): q=%@", @(delay), searchText);

  BOOL disableProgressWhenFinished = delay;
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    [self.delegate searchControl:self shouldSearchWithQuery:searchText delay:delay completion:^(NSError *error, KBSearchResults *searchResults) {
      dispatch_async(dispatch_get_main_queue(), ^{
        if ([gself.searchText isEqual:searchText]) {
          if (error) {
            // TODO: Handle error, retry button
            return;
          }
          [gself setSearchResults:searchResults];
          if (disableProgressWhenFinished) [self.delegate searchControl:self progressEnabled:NO];
        }
      });
    }];
  });
}

@end
