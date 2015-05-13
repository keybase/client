//
//  KBFileListEditView.m
//  Keybase
//
//  Created by Gabriel on 5/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFileListEditView.h"

#import "KBFileListView.h"

@interface KBFileListEditView ()
@property KBFileListView *fileListView;
@end

@implementation KBFileListEditView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];
  GHWeakSelf gself = self;
  YOVBox *toolbarView = [YOVBox box];
  [toolbarView kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];
  [self addSubview:toolbarView];

  YOHBox *buttonsView = [YOHBox box:@{@"insets": @(10)}];
  [toolbarView addSubview:buttonsView];
  [toolbarView addSubview:[KBBox horizontalLine]];

  NSImage *attachmentImage = [NSImage imageNamed:@"1-Edition-black-clip-1-24"];
  attachmentImage.size = CGSizeMake(12, 12);
  KBButton *attachmentButton = [KBButton buttonWithText:@"Add files" image:attachmentImage style:KBButtonStyleToolbar];
  attachmentButton.targetBlock = ^{ [gself chooseInput]; };
  [buttonsView addSubview:attachmentButton];

  _fileListView = [[KBFileListView alloc] init];
  _fileListView.imageLabelStyle = KBImageLabelStyleLarge;
  _fileListView.onMenuSelect  = ^(NSIndexPath *indexPath) {
    NSMenu *menu = [[NSMenu alloc] initWithTitle:@""];
    [menu addItemWithTitle:@"Remove" action:@selector(removeFile:) keyEquivalent:@""];
    return menu;
  };
  [self addSubview:_fileListView];

  self.viewLayout = [YOBorderLayout layoutWithCenter:_fileListView top:@[toolbarView] bottom:nil insets:UIEdgeInsetsZero spacing:0];
}

- (NSArray *)files {
  return _fileListView.objects;
}

- (void)addFile:(KBFile *)file {
  [_fileListView addObjects:@[file] animation:NSTableViewAnimationEffectNone];
}

- (void)removeFile:(id)sender {
  if (!_fileListView.menuIndexPath) return;
  [_fileListView.dataSource removeObjectAtIndexPath:_fileListView.menuIndexPath];
  [_fileListView reloadData];
}

- (void)chooseInput {
  NSOpenPanel *panel = [NSOpenPanel openPanel];
  panel.prompt = @"OK";
  panel.title = @"Choose a file...";
  panel.allowsMultipleSelection = YES;
  //GHWeakSelf gself = self;
  [panel beginSheetModalForWindow:self.window completionHandler:^(NSInteger result) {
    if (result == NSFileHandlingPanelOKButton) {
      for (NSURL *URL in [panel URLs]) {
        if ([URL isFileURL]) {
          [self addFile:[KBFile fileWithURL:URL]];
        }
      }
    }
  }];
}

@end
