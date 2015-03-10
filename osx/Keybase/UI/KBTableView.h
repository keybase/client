//
//  KBListView.h
//  Keybase
//
//  Created by Gabriel on 2/2/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>
#import "KBCellDataSource.h"
#import "KBScrollView.h"

typedef void (^KBCellSelectBlock)(id sender, NSIndexPath *indexPath, id object);


@interface KBTableView : YONSView <NSTableViewDelegate, NSTableViewDataSource>

@property (readonly) KBScrollView *scrollView;
@property (readonly) NSTableView *view;

@property (copy) KBCellSelectBlock selectBlock;

@property (readonly) KBCellDataSource *dataSource;


- (void)setObjects:(NSArray *)objects;
- (void)addObjects:(NSArray *)objects;
- (void)removeAllObjects;

- (void)setObjects:(NSArray *)objects animated:(BOOL)animated;

- (void)deselectAll;

- (id)selectedObject;

// Subclasses can implement
- (void)selectItem:(id)item;

@end
