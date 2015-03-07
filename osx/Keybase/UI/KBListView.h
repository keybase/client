//
//  KBListView.h
//  Keybase
//
//  Created by Gabriel on 2/2/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>

typedef void (^KBCellSetBlock)(id cell, id object, NSIndexPath *indexPath, id containingView/*NSTableView*/, BOOL dequeued);
typedef void (^KBCellSelectBlock)(id sender, NSIndexPath *indexPath, id object);


@interface KBListView : YONSView <NSTableViewDelegate, NSTableViewDataSource>

@property (readonly) Class prototypeClass;
@property (readonly) NSTableView *tableView;

@property (copy) KBCellSetBlock cellSetBlock;
@property (copy) KBCellSelectBlock selectBlock;

// rowHeight of 0 means dynamic
+ (KBListView *)listViewWithPrototypeClass:(Class)prototypeClass rowHeight:(CGFloat)rowHeight;

- (void)setObjects:(NSArray *)objects;
- (void)addObjects:(NSArray *)objects;
- (void)removeAllObjects;

- (void)setObjects:(NSArray *)objects animated:(BOOL)animated;

- (void)deselectAll;

- (id)selectedObject;


@end


@interface KBListViewDynamicHeight : KBListView
@end