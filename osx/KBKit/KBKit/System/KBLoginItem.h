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

- (BOOL)isEnabled;
- (BOOL)setEnabled:(BOOL)loginEnabled error:(NSError **)error;

+ (BOOL)setEnabled:(BOOL)loginEnabled URL:(NSURL *)URL error:(NSError **)error;
+ (BOOL)isEnabledForURL:(NSURL *)URL;

@end
