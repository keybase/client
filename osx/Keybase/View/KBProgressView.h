//
//  KBProgressView.h
//  Keybase
//
//  Created by Gabriel on 3/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBAppDefines.h"

typedef void (^KBWork)(KBCompletion completion);

@interface KBProgressView : YOView

@property (copy) KBWork work;

- (void)setProgressTitle:(NSString *)progressTitle;

- (void)open:(id)sender;

- (void)doIt:(dispatch_block_t)close;

- (void)openAndDoIt:(id)sender;

//- (void)close:(id)sender;

@end
