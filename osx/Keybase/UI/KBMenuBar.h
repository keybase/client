//
//  KBMenuBar.h
//  Keybase
//
//  Created by Gabriel on 1/28/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>

#import "KBButton.h"

@interface KBMenuBar : YONSView

- (void)setBackTitle:(NSString *)backTitle targetBlock:(dispatch_block_t)targetBlock;

@end
