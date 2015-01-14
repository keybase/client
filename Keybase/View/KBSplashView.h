//
//  KBSplashView.h
//  Keybase
//
//  Created by Gabriel on 1/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBUIDefines.h"

@interface KBSplashView : KBView

@property (copy) dispatch_block_t closeBlock;

- (void)setTitle:(NSString *)title message:(NSString *)message;
- (void)setTitle:(NSString *)title message:(NSString *)message messageFont:(NSFont *)messageFont;

- (void)addButton:(KBButton *)button;
- (void)addButtonWithTitle:(NSString *)title target:(dispatch_block_t)target;
- (void)addButtonWithTitle:(NSString *)title size:(CGSize)size target:(dispatch_block_t)target;
- (void)addLinkButtonWithTitle:(NSString *)title target:(dispatch_block_t)target;


@end
