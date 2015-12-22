//
//  KBLoginItem.h
//  KBKit
//
//  Created by Gabriel on 12/21/15.
//  Copyright © 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBDefines.h"

@interface KBLoginItem : NSObject

- (instancetype)initWithURL:(NSURL *)URL;

@property (readonly) NSURL *URL;

- (BOOL)isLoginEnabled;
- (BOOL)setLoginEnabled:(BOOL)loginEnabled error:(NSError **)error;

+ (BOOL)setLoginEnabled:(BOOL)loginEnabled URL:(NSURL *)URL error:(NSError **)error;
+ (BOOL)isLoginEnabledForURL:(NSURL *)URL;

@end
