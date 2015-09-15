//
//  KBErrorStatusView.h
//  Keybase
//
//  Created by Gabriel on 3/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <KBAppKit/KBAppKit.h>

@interface KBErrorStatusView : YOView

- (void)setError:(NSError *)error title:(NSString *)title retry:(dispatch_block_t)retry close:(dispatch_block_t)close;

@end
