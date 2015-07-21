//
//  KBActivity.h
//  Keybase
//
//  Created by Gabriel on 4/28/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <AppKit/AppKit.h>

@interface KBActivity : NSObject

+ (void)setProgressEnabled:(BOOL)progressEnabled sender:(id)sender;
+ (void)setProgressEnabled:(BOOL)progressEnabled sender:(id)sender except:(NSArray *)except;

+ (void)setProgressEnabled:(BOOL)progressEnabled subviews:(NSArray *)subviews;

+ (BOOL)setError:(NSError *)error sender:(id)sender;
+ (BOOL)setError:(NSError *)error sender:(id)sender completion:(void (^)(NSModalResponse response))completion;

@end
