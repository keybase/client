//
//  FilesViewController.m
//  KeybaseShare
//
//  Created by John Zila on 10/25/18.
//  Copyright © 2018 Keybase. All rights reserved.
//

#import "FilesViewController.h"
#import "keybase/keybase.h"

@interface FilesViewController ()
@property (nonatomic) NSString* path; // the path we are currently showing
@property NSArray* directoryEntries; // the directory entries at the current path
@end

NSString* const UpOneLevel = @"⤴ [up one level]";
int const DirentTypeFolder = 1;

@implementation FilesViewController

@synthesize path = _path;

- (void)viewDidLoad {
  [super viewDidLoad];
  
  self.preferredContentSize = CGSizeMake(self.view.frame.size.width, 2*self.view.frame.size.height); // expand
  self.definesPresentationContext = YES;
  [self setPath:@"/"];
  [self dispatchFilesBrowser];
}

- (void)dispatchFilesBrowser {
  // show this spinner on top of the table view until we have processed the files.
  UIActivityIndicatorView* av = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleGray];
  [self.view addSubview:av];
  [av setTranslatesAutoresizingMaskIntoConstraints:NO];
  [av setHidesWhenStopped:YES];
  [av bringSubviewToFront:self.view];
  [av startAnimating];
  [self.tableView addConstraints:@[
                                   [NSLayoutConstraint constraintWithItem:av
                                                                attribute:NSLayoutAttributeCenterX
                                                                relatedBy:NSLayoutRelationEqual
                                                                   toItem:self.tableView
                                                                attribute:NSLayoutAttributeCenterX
                                                               multiplier:1 constant:0],
                                   [NSLayoutConstraint constraintWithItem:av
                                                                attribute:NSLayoutAttributeCenterY
                                                                relatedBy:NSLayoutRelationEqual
                                                                   toItem:self.tableView
                                                                attribute:NSLayoutAttributeCenterY
                                                               multiplier:1 constant:0]
                                   ]
   ];
  
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSError* error = NULL;
    [self setDirectoryEntries:[NSArray new]];
    NSString* jsonFiles = KeybaseExtensionListPath(self.path, &error); // returns the path list in JSON format
    if (jsonFiles == nil || error != nil) {
      NSLog(@"failed to get files: %@", error);
    } else {
      [self parseFiles:jsonFiles];
    }
    dispatch_async(dispatch_get_main_queue(), ^{
      [av stopAnimating];
      [self.tableView reloadData];
      [av removeFromSuperview];
    });
  });
}

NSInteger sortEntries(NSDictionary* one, NSDictionary* two, void* context) {
  int t1 = [one[@"direntType"] intValue];
  int t2 = [two[@"direntType"] intValue];
  if (t1 == 1 && t2 != 1) {
    // `one` is a folder and `two` isn't.
    return NSOrderedAscending;
  } else if (t2 == 1 && t1 != 1) {
    // `two` is a folder and `one` isn't.
    return NSOrderedDescending;
  } else {
    // Both are a folder or neither is.
    return [one[@"name"] compare:two[@"name"]];
  }
}

bool filterWritableEntries(NSDictionary* entry) {
  return entry[@"writable"];
}

- (void)parseFiles:(NSString*)jsonFiles {
  NSError* error = nil;
  NSData* data = [jsonFiles dataUsingEncoding:NSUTF8StringEncoding];
  NSArray* items = [NSJSONSerialization JSONObjectWithData:data options: NSJSONReadingMutableContainers error: &error];
  NSArray* sortedAndFilteredItems;
  if (!items) {
    if (error) {
      NSLog(@"parseFiles: error parsing JSON: %@", error);
    }
    // At least show an empty folder.
    sortedAndFilteredItems = @[];
  } else {
    // Sort items: directories first, then alphabetically.
    sortedAndFilteredItems = [items sortedArrayUsingFunction:sortEntries context:NULL];
    
    // For paths deeper than 2, filter out folders that aren't writable.
    unsigned long pathLength = [self pathLength];
    if (pathLength > 2) {
      sortedAndFilteredItems = [sortedAndFilteredItems filteredArrayUsingPredicate:[NSPredicate predicateWithBlock:^BOOL(id entry, NSDictionary* bindings) {
        return entry[@"writable"];
      }]];
    }
  }
  if ([self.path isEqualToString:@"/"]) {
    // If we're at the root, don't show a back navigation item.
    [self setDirectoryEntries:sortedAndFilteredItems];
  } else {
    // Otherwise, prepend a back navigation item.
    NSMutableArray* itemsWithBack = [[NSMutableArray alloc] init];
    [itemsWithBack addObject:[[NSDictionary alloc] initWithObjectsAndKeys:
                              UpOneLevel, @"name",
                              [NSNumber numberWithInt:DirentTypeFolder], @"direntType",
                              nil]];
    [itemsWithBack addObjectsFromArray:sortedAndFilteredItems];
    [self setDirectoryEntries:itemsWithBack];
  }
}

- (void)didReceiveMemoryWarning {
  KeybaseExtensionForceGC();
  [super didReceiveMemoryWarning];
}

#pragma mark - Table view data source

- (NSInteger)numberOfSectionsInTableView:(UITableView *)tableView {
  return 1;
}

- (NSInteger)tableView:(UITableView *)tableView numberOfRowsInSection:(NSInteger)section {
  return [self.directoryEntries count];
}

- (NSDictionary*)getItemAtIndex:(NSIndexPath*)indexPath {
  NSInteger index = [indexPath item];
  return self.directoryEntries[index];
}

- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath {
  UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:@"ConvCell"];
  if (NULL == cell) {
    cell = [[UITableViewCell alloc] initWithStyle:UITableViewCellStyleDefault reuseIdentifier:@"ConvCell"];
  }
  NSDictionary* item = [self getItemAtIndex:indexPath];
  UILabel* textLabel = [cell textLabel];
  [textLabel setText:item[@"name"]];
  if ([item[@"direntType"] intValue] == DirentTypeFolder) {
    // Style folders differently from files. Use Keybase blue.
    [textLabel setTextColor:DirentColorFolder];
    [textLabel setFont:[UIFont boldSystemFontOfSize: textLabel.font.pointSize]];
  } else {
    [textLabel setTextColor:DirentColorOther];
    [textLabel setFont:[UIFont systemFontOfSize: textLabel.font.pointSize]];
  }
  return cell;
}

- (void)tableView:(UITableView *)tableView didSelectRowAtIndexPath:(NSIndexPath *)indexPath {
  NSDictionary* target = [self getItemAtIndex:indexPath];
  if ([indexPath isEqual:[NSIndexPath indexPathForRow:0 inSection:0]] && [target[@"name"] isEqualToString:UpOneLevel]) {
    // '..' navigates back up.
    NSArray* pathElems = [self.path componentsSeparatedByString:@"/"];
    NSArray* upOneDirectory = [pathElems subarrayWithRange:NSMakeRange(0, [pathElems count] - 2)];
    [self setPath:[NSString stringWithFormat:@"%@/", [upOneDirectory componentsJoinedByString:@"/"]]];
    [self dispatchFilesBrowser];
  } else if ([target[@"direntType"] intValue] == 1) {
    // Folders navigate down.
    [self setPath:[NSString stringWithFormat:@"%@%@/", self.path, target[@"name"]]];
    [self dispatchFilesBrowser];
  } else {
    // Files do not affect navigation.
    [tableView deselectRowAtIndexPath:indexPath animated:FALSE];
  }
}

- (void)sendPathToDelegate {
  [self.delegate folderSelected:self.path];
}

- (unsigned long)pathLength {
  NSArray* pathElems = [self.path componentsSeparatedByString:@"/"];
  return [pathElems count];
}

- (void)setPath:(NSString*)path {
  _path = path;
  NSArray* pathElems = [self.path componentsSeparatedByString:@"/"];
  unsigned long pathLength = [pathElems count];
  if (pathLength <= 2) {
    [self setTitle:@"Keybase"];
    self.navigationItem.rightBarButtonItem = nil;
  } else {
    NSString* pathName = pathElems[pathLength - 2];
    [self setTitle:pathName];
    if (pathLength >= 4) {
      // Allow selecting any folder under the TLF level, since we've already filtered to writable
      // folders only.
      UIBarButtonItem* doneButton = [[UIBarButtonItem alloc] initWithTitle:@"Send here" style:UIBarButtonItemStyleDone target:self action:@selector(sendPathToDelegate)];
      self.navigationItem.rightBarButtonItem = doneButton;
    } else {
      self.navigationItem.rightBarButtonItem = nil;
    }
  }
}

- (NSString*)path {
  return _path;
}

@end
