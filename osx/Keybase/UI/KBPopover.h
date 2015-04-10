//
//  KBPopover.h
//  Keybase
//
//  Created by Gabriel on 4/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>

@interface KBPopover : NSObject <NSWindowDelegate>

@property YOView *contentView;
@property (nonatomic) CGSize contentSize;

- (void)show:(NSView *)sender;

- (void)close;

- (BOOL)isShowing;

@end
