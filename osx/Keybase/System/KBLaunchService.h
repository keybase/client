//
//  KBLaunchCtl.h
//  Keybase
//
//  Created by Gabriel on 3/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <GHKit/GHKit.h>
#import "KBDefines.h"
#import "KBLaunchCtl.h"

@interface KBLaunchService : NSObject

@property (readonly) NSString *label;
@property (readonly) NSDictionary *plist;

- (instancetype)initWithLabel:(NSString *)label plist:(NSDictionary *)plist;

- (void)status:(KBLaunchStatus)completion;

- (void)install:(void (^)(NSError *error, BOOL installed))completion;

@end
