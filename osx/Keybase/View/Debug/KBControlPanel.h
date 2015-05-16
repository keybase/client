//
//  KBControlPanel.h
//  Keybase
//
//  Created by Gabriel on 5/15/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBContentView.h"
#import "KBComponent.h"

@interface KBControlPanel : KBContentView

+ (instancetype)openWithComponents:(NSArray */*of id<KBComponent>*/)components sender:(id)sender;

- (void)addComponents:(NSArray */*of id<KBComponent>*/)components;

@end
