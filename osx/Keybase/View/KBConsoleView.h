//
//  KBConsoleView.h
//  Keybase
//
//  Created by Gabriel on 3/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBView.h"
#import "KBDebugStatusView.h"
#import "KBAppView.h"

@interface KBConsoleView : KBView <KBAppViewDelegate>

@property (readonly) KBDebugStatusView *debugStatusView;

- (void)log:(NSString *)message;

@end
