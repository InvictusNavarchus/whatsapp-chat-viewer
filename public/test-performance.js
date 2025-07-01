/**
 * Performance test script for the normalized database
 * Run this in the browser console to verify performance improvements
 */

/**
 * Main performance test function
 */
async function testPerformance() {
  console.log('🚀 Starting performance tests for normalized database...');
  
  // Test bookmark operations
  console.log('\n📊 Testing bookmark performance:');
  
  const testMessageId = 'test-message-' + Date.now();
  const testChatId = 'test-chat-' + Date.now();
  
  try {
    // Test save bookmark - use relative imports that will be resolved by the build system
    console.time('Save Bookmark');
    const normalizedDbModule = await import('./dist/src/utils/normalizedDb.js');
    await normalizedDbModule.saveBookmark(testMessageId, testChatId);
    console.timeEnd('Save Bookmark');
    
    // Test load bookmarks
    console.time('Load All Bookmarks');
    const bookmarks = await normalizedDbModule.loadBookmarks();
    console.timeEnd('Load All Bookmarks');
    console.log(`📚 Loaded ${bookmarks.length} bookmarks`);
    
    // Test bookmark status check
    console.time('Check Bookmark Status');
    const isBookmarked = await normalizedDbModule.isMessageBookmarked(testMessageId);
    console.timeEnd('Check Bookmark Status');
    console.log(`✅ Message is bookmarked: ${isBookmarked}`);
    
    // Test batch bookmark status
    console.time('Batch Bookmark Status Check');
    const messageIds = bookmarks.slice(0, 10).map(b => b.id);
    const statuses = await normalizedDbModule.getBookmarkStatus(messageIds);
    console.timeEnd('Batch Bookmark Status Check');
    console.log(`🔍 Checked ${Object.keys(statuses).length} message statuses`);
    
    // Clean up test bookmark
    await normalizedDbModule.removeBookmark(testMessageId);
    
    console.log('\n✨ Performance tests completed!');
    console.log('All operations should be sub-10ms for optimal performance.');
    
    // Show performance summary if available
    if (window.bookmarkPerformance) {
      console.log('\n📈 Performance Summary:');
      window.bookmarkPerformance.logSummary();
    }
    
  } catch (error) {
    console.error('❌ Performance test failed:', error);
    console.error('Make sure the application is built and served properly.');
  }
}

// Auto-run the test
testPerformance();

// Export for use in console
window.testBookmarkPerformance = testPerformance;
