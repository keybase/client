//
//  KBButtonView.h
//  Keybase
//
//  Created by Gabriel on 4/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>

@interface KBButtonView : YOView

+ (instancetype)buttonViewWithView:(YOView *)view targetBlock:(dispatch_block_t)targetBlock;

@end
