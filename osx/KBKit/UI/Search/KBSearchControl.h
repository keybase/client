//
//  KBSearchControl.h
//  Keybase
//
//  Created by Gabriel on 3/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBSearchResults.h"

@class KBSearchControl;

@protocol KBSearchControlDelegate
- (void)searchControl:(KBSearchControl *)searchControl shouldDisplaySearchResults:(KBSearchResults *)searchResults;
- (void)searchControlShouldClearSearchResults:(KBSearchControl *)searchControl;
- (void)searchControl:(KBSearchControl *)searchControl progressEnabled:(BOOL)progressEnabled;
- (void)searchControl:(KBSearchControl *)searchControl shouldSearchWithQuery:(NSString *)query delay:(BOOL)delay completion:(void (^)(NSError *error, KBSearchResults *results))completion;
- (void)searchControlShouldOpen:(KBSearchControl *)searchControl;
- (void)searchControlShouldClose:(KBSearchControl *)searchControl;
@end

@interface KBSearchControl : YOView

@property (weak) id<KBSearchControlDelegate> delegate;

- (void)textDidChange:(NSString *)text;

@end
