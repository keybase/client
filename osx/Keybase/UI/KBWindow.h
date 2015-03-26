//
//  KBWindow.h
//  Keybase
//
//  Created by Gabriel on 1/28/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

#import "KBAppKitDefines.h"
#import <YOLayout/YOLayout.h>

typedef NS_ENUM (NSInteger, KBWindowPosition) {
  KBWindowPositionCenter,
  KBWindowPositionRight,
};


@interface KBWindow : NSWindow <NSWindowDelegate>

+ (KBWindow *)windowWithContentView:(NSView *)contentView size:(CGSize)size retain:(BOOL)retain;

@end

@interface NSWindow (KBWindow)

- (NSWindow *)kb_addChildWindowForView:(YOView *)view rect:(CGRect)rect position:(KBWindowPosition)position title:(NSString *)title errorHandler:(KBErrorHandler)errorHandler;

@end
