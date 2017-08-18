//
//  KBWorkspace.h
//  Keybase
//
//  Created by Gabriel on 6/8/15.
//  Copyright (c) 2017 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

@interface KBWorkspace : NSObject

+ (NSString *)applicationSupport:(NSArray *)subdirs create:(BOOL)create error:(NSError **)error;

+ (void)openURLString:(NSString *)URLString prompt:(BOOL)prompt sender:(id)sender;

+ (NSUserDefaults *)userDefaults;

+ (void)setupLogging:(BOOL)debug;

+ (NSWindow *)windowWithContentView:(NSView<NSWindowDelegate> *)contentView;

+ (NSWindow *)createMainWindow:(NSView<NSWindowDelegate> *)view;

@end
