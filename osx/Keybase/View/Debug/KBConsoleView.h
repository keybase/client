//
//  KBConsoleView.h
//  Keybase
//
//  Created by Gabriel on 3/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBRuntimeStatusView.h"
#import "KBAppView.h"

@interface KBConsoleView : YOView <KBAppViewDelegate>

@property (readonly) KBRuntimeStatusView *runtimeStatusView;

- (void)log:(NSString *)message;

@end
