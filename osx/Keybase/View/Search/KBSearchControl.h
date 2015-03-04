//
//  KBSearchControl.h
//  Keybase
//
//  Created by Gabriel on 3/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"

@class KBSearchControl;

@protocol KBSearchControlDelegate
- (void)searchControl:(KBSearchControl *)searchControl shouldDisplaySearchResults:(NSArray *)searchResults;
- (void)searchControlShouldClearSearchResults:(KBSearchControl *)searchControl;
- (void)searchControl:(KBSearchControl *)searchControl progressEnabled:(BOOL)progressEnabled;
- (void)searchControl:(KBSearchControl *)searchControl shouldSearchWithQuery:(NSString *)query completion:(void (^)(NSError *error, NSArray *searchResults))completion;
@end

@interface KBSearchControl : YONSView <NSTextFieldDelegate>

@property (weak) id<KBSearchControlDelegate> delegate;

@end
