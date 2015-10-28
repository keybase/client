//
//  KBFoldersView.m
//  Keybase
//
//  Created by Gabriel on 3/11/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFoldersView.h"

#import "KBFileListView.h"
#import "KBSearchField.h"
#import "KBViews.h"
#import "KBFolderUsersView.h"
#import "KBFolderAddView.h"
#import "KBApp.h"

@interface KBFoldersView ()
@property NSSegmentedControl *segmentedControl;
@property KBFileListView *favoritesView;
@property KBFileListView *foldersView;
@property KBButton *addButton;
@property KBButton *trashButton;
@property KBSearchField *searchField;
@end

@implementation KBFoldersView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];

  _segmentedControl = [[NSSegmentedControl alloc] init];
  [_segmentedControl setSegmentCount:2];
  [_segmentedControl setLabel:@"Favorites" forSegment:0];
  [_segmentedControl setLabel:@"All" forSegment:1];
  [_segmentedControl setSelectedSegment:0];
  [_segmentedControl setTarget:self];
  [_segmentedControl setAction:@selector(_segmentedChange:)];
  [_segmentedControl setWidth:70 forSegment:0];
  [_segmentedControl setWidth:70 forSegment:1];
  //[_segmentedControl setSegmentStyle:NSSegmentStyleCapsule];
  [self addSubview:_segmentedControl];

  GHWeakSelf gself = self;
  _addButton = [KBFontIcon buttonForIcon:@"plus" text:nil style:KBButtonStyleDefault options:KBButtonOptionsToolbar sender:self];
  _addButton.targetBlock = ^{ [gself addFolder]; };
  [self addSubview:_addButton];

//  NSImage *trashImage = [NSImage imageNamed:@"1-Edition-black-bin-2-24"];
//  trashImage.size = CGSizeMake(16, 16);
//  _trashButton = [KBButton buttonWithImage:trashImage style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
//  [self addSubview:_trashButton];

  _searchField = [[KBSearchField alloc] init];
  [self addSubview:_searchField];

  KBBox *border = [KBBox horizontalLine];
  [self addSubview:border];

  _favoritesView = [[KBFileListView alloc] init];
  [_favoritesView setFileColumnStyle:KBFileColumnStyleNameDate];
  _favoritesView.identifier = @"Favorites";
  [self addSubview:_favoritesView];

  _foldersView = [[KBFileListView alloc] init];
  [_foldersView setFileColumnStyle:KBFileColumnStyleNameDate];
  _foldersView.identifier = @"Folders";
  _foldersView.hidden = YES;
  [self addSubview:_foldersView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat x = 10;
    CGFloat y = 10;
    CGSize segmentedSize = [yself.segmentedControl sizeThatFits:CGSizeMake(size.width, size.height)];
    segmentedSize.width += 2; // Fix for NSSegmentedControl drawing outsize itself
    segmentedSize.height += 2;
    //y += [layout centerWithSize:segmentedSize frame:CGRectMake(0, y, size.width, 0) view:yself.segmentedControl].size.height + 9;
    x += [layout setFrame:CGRectMake(x, y + 2, segmentedSize.width, segmentedSize.height) view:yself.segmentedControl].size.width + 20;

    x += [layout setFrame:CGRectMake(x, y, 24, 24) view:yself.addButton].size.width + 20;
    //x += [layout setFrame:CGRectMake(x, y, 24, 24) view:yself.trashButton].size.width + 8;

    [layout setFrame:CGRectMake(x, y, size.width - x - 10, 24) view:yself.searchField];

    y += 33;

    [layout setFrame:CGRectMake(0, y, size.width, 1) view:border];
    y += 1;

    [layout setFrame:CGRectMake(0, y, size.width, size.height - y) view:yself.favoritesView];
    [layout setFrame:CGRectMake(0, y, size.width, size.height - y) view:yself.foldersView];
    return size;
  }];
}

- (void)addFolder {
  //KBFolderUsersView *view = [[KBFolderUsersView alloc] init];
  //[self.window kb_addChildWindowForView:view rect:CGRectMake(0, 0, 500, 400) position:KBWindowPositionCenter title:@"Add Folder" fixed:NO makeKey:YES];
  KBFolderAddView *folderAddView = [[KBFolderAddView alloc] init];
  folderAddView.client = self.client;
  folderAddView.close = ^(id sender) {
    NSWindow *window = [sender window];
    [window close];
  };
  folderAddView.completion = ^(NSArray *usernames) {

  };
  [self.window kb_addChildWindowForView:folderAddView rect:CGRectMake(0, 0, 400, 400) position:KBWindowPositionCenter title:@"Add Folder" fixed:NO makeKey:YES];
}

- (void)addFolderForUsernames:(NSArray *)usernames {
  NSError *error = nil;
  NSString *folder = [usernames join:@","];
  NSString *path = [KBApp.environment.config.mountDir stringByAppendingPathComponent:folder];
  if (![NSFileManager.defaultManager createDirectoryAtPath:path withIntermediateDirectories:NO attributes:@{} error:&error]) {
    [KBActivity setError:error sender:self];
  }
}

- (void)listFolders {
  NSError *error = nil;
  NSArray *files = [NSFileManager.defaultManager contentsOfDirectoryAtPath:KBApp.environment.config.mountDir error:&error];
  if (!files) {
    [KBActivity setError:error sender:self];
    return;
  }

  


}

- (void)_segmentedChange:(id)sender {
  NSInteger segment = [sender selectedSegment];
  if (segment == 0) { _favoritesView.hidden = NO; _foldersView.hidden = YES; }
  if (segment == 1) { _favoritesView.hidden = YES; _foldersView.hidden = NO; }
}

@end
