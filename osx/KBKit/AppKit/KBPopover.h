//
//  KBPopover.h
//  Keybase
//
//  Created by Gabriel on 4/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>

typedef NS_OPTIONS (NSInteger, KBPopoverOptions) {
  KBPopoverOptionsShadow = 1 << 1,
};

// Popover as view
@interface KBPopover : NSObject

@property YOView *contentView;
@property (nonatomic) CGRect contentRect;
@property (nonatomic) CGSize maxContentSize;
@property (readonly, getter=isShowing) BOOL showing;

- (void)showAboveView:(NSView *)view options:(KBPopoverOptions)options;
- (void)hide;

@end

// Popover as window
@interface KBPopoverWindow : NSObject <NSWindowDelegate>

@property YOView *contentView;
@property (nonatomic) CGSize contentSize;
@property (readonly, getter=isShowing) BOOL showing;

- (void)showInWindowAboveView:(NSView *)view position:(CGPoint)position options:(KBPopoverOptions)options;
- (void)hide;

@end
