/**
 * Performance test script for the normalized database
 * Run this in the browser console to verify performance improvements
 */

(async function testPerformance() {
  console.log('🚀 Starting performance tests for normalized database...');
  
  // Test bookmark operations
  console.log('\n📊 Testing bookmark performance:');
  
  const testMessageId = 'test-message-' + Date.now();
  const testChatId = 'test-chat-' + Date.now();
  
  try {
    // Test save bookmark
    console.time('Save Bookmark');
    const { saveBookmark } = await import('/src/utils/normalizedDb.ts');
    await saveBookmark(testMessageId, testChatId);
    console.timeEnd('Save Bookmark');
    
    // Test load bookmarks
    console.time('Load All Bookmarks');
    const { loadBookmarks } = await import('/src/utils/normalizedDb.ts');
    const bookmarks = await loadBookmarks();
    console.timeEnd('Load All Bookmarks');
    console.log(`📚 Loaded ${bookmarks.length} bookmarks`);
    
    // Test bookmark status check
    console.time('Check Bookmark Status');
    const { isMessageBookmarked } = await import('/src/utils/normalizedDb.ts');
    const isBookmarked = await isMessageBookmarked(testMessageId);
    console.timeEnd('Check Bookmark Status');
    console.log(`✅ Message is bookmarked: ${isBookmarked}`);
    
    // Test batch bookmark status
    console.time('Batch Bookmark Status Check');
    const { getBookmarkStatus } = await import('/src/utils/normalizedDb.ts');
    const messageIds = bookmarks.slice(0, 10).map(b => b.id);
    const statuses = await getBookmarkStatus(messageIds);
    console.timeEnd('Batch Bookmark Status Check');
    console.log(`🔍 Checked ${Object.keys(statuses).length} message statuses`);
    
    // Clean up test bookmark
    const { removeBookmark } = await import('/src/utils/normalizedDb.ts');
    await removeBookmark(testMessageId);
    
    console.log('\n✨ Performance tests completed!');
    console.log('All operations should be sub-10ms for optimal performance.');
    
    // Show performance summary if available
    if (window.bookmarkPerformance) {
      console.log('\n📈 Performance Summary:');
      window.bookmarkPerformance.logSummary();
    }
    
  } catch (error) {
    console.error('❌ Performance test failed:', error);
  }
})();

// Export for use in console
window.testBookmarkPerformance = async function() {
  const script = document.createElement('script');
  script.textContent = '(' + testPerformance.toString() + ')()';
  document.head.appendChild(script);
  document.head.removeChild(script);
};
