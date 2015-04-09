//
//  KBSearcher.h
//  Keybase
//
//  Created by Gabriel on 4/8/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBRPC.h"
#import "AppDelegate.h"
#import "KBRUtils.h"
#import "KBSearchResults.h"

@interface KBSearcher : NSObject

- (void)search:(NSString *)query client:(KBRPClient *)client remote:(BOOL)remote completion:(void (^)(NSError *error, KBSearchResults *searchResults))completion;

@end
