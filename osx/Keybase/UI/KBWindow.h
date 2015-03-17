//
//  KBWindow.h
//  Keybase
//
//  Created by Gabriel on 1/28/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

typedef NS_ENUM (NSInteger, KBWindowPosition) {
  KBWindowPositionCenter,
  KBWindowPositionRight,
};


@interface KBWindow : NSWindow

+ (KBWindow *)windowWithContentView:(NSView *)contentView size:(CGSize)size retain:(BOOL)retain;

+ (dispatch_block_t)openWindowWithView:(NSView *)view size:(CGSize)size sender:(NSView *)sender;

@end

@interface NSWindow (KBWindow)

- (void)addChildWindowForView:(NSView *)view rect:(CGRect)rect position:(KBWindowPosition)position title:(NSString *)title;

@end
