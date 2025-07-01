## WhatsApp Chat Viewer

A modern web application for viewing and managing WhatsApp chat exports. Upload your exported WhatsApp chat files to view messages in a clean, organized interface with bookmarking functionality.

### Features

- **Chat Import**: Upload WhatsApp chat export files (.txt format)
- **Message Viewing**: Clean, organized display of chat messages
- **Bookmark Messages**: Save important messages for quick access
- **Persistent Storage**: Data is automatically saved using IndexedDB for chat data and localStorage for settings
- **Responsive Design**: Works seamlessly on desktop and mobile devices

### Data Storage

- **Chat Data**: Stored in IndexedDB for better performance and larger storage capacity
- **Configuration Data**: Bookmarks and user settings stored in localStorage
- **Automatic Migration**: Legacy localStorage chat data is automatically migrated to IndexedDB
