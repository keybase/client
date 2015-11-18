//
//  KBStatusView.h
//  Keybase
//
//  Created by Gabriel on 3/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>

@interface KBStatusView : YOView

@property UIEdgeInsets insets;

- (void)setError:(NSError *)error title:(NSString *)title retry:(dispatch_block_t)retry close:(dispatch_block_t)close;

- (void)setText:(NSString *)text description:(NSString *)description title:(NSString *)title retry:(dispatch_block_t)retry close:(dispatch_block_t)close;

@end
