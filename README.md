## WhatsApp Chat Viewer

A modern web application for viewing and managing WhatsApp chat exports. Upload your exported WhatsApp chat files to view messages in a clean, organized interface with high-performance bookmarking functionality.

### Features

- **Chat Import**: Upload WhatsApp chat export files (.txt format)
- **Message Viewing**: Clean, organized display of chat messages with lazy loading
- **High-Performance Bookmarks**: Lightning-fast bookmark operations with IndexedDB storage
- **Normalized Database**: Efficient data structure with proper indexing for optimal performance
- **Persistent Storage**: All data automatically saved with migration support
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Performance Monitoring**: Built-in performance tracking for optimization

### Data Storage Architecture

The application uses a normalized IndexedDB structure for optimal performance:

- **Chat Metadata**: Lightweight chat information (name, dates, participant counts)
- **Messages**: Individual message records with proper indexing
- **Bookmarks**: Separate bookmark records with fast lookup capabilities
- **Automatic Migration**: Seamless migration from legacy storage formats

### Performance Improvements

- **Sub-10ms bookmark operations** (compared to 4+ seconds in legacy systems)
- **Lazy loading** for chat messages - only load what you need
- **Efficient indexing** with O(1) lookups instead of O(n) searches
- **Optimistic updates** for instant UI feedback
- **Batch operations** for bulk data handling
- **Memory-efficient caching** with smart cache management

### Development Features

Access performance metrics in the browser console:
```javascript
// View performance summary
window.bookmarkPerformance.logSummary()

// Get specific operation metrics
window.bookmarkPerformance.getAverage('loadBookmarks')

// Clear performance data
window.bookmarkPerformance.clear()
```
