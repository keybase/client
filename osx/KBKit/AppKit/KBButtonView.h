//
//  KBButtonView.h
//  Keybase
//
//  Created by Gabriel on 4/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>

#import "KBButton.h"

@interface KBButtonView : YOView

@property (readonly) KBButton *button;

+ (instancetype)buttonViewWithView:(YOView *)view targetBlock:(dispatch_block_t)targetBlock;

- (void)setView:(YOView *)view;

- (void)setButtonStyle:(KBButtonStyle)style options:(KBButtonOptions)options;

@end
