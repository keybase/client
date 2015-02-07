//
//  KBTableView.h
//  Keybase
//
//  Created by Gabriel on 2/2/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>

@interface KBTableView : YONSView <NSTableViewDelegate, NSTableViewDataSource>

@property Class prototypeClass;

- (void)setObjects:(NSArray *)objects;

- (void)updateView:(YONSView *)view object:(id)object;

- (void)select:(id)object;

- (void)deselectAll;

@end
