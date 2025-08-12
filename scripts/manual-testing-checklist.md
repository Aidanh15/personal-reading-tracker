# Manual Testing Checklist

## Device and Browser Testing Matrix

### Desktop Browsers
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Mobile Devices
- [ ] iPhone Safari (iOS 15+)
- [ ] Android Chrome (Android 10+)
- [ ] iPad Safari (iPadOS 15+)

### Screen Resolutions
- [ ] 1920x1080 (Desktop)
- [ ] 1366x768 (Laptop)
- [ ] 768x1024 (Tablet Portrait)
- [ ] 1024x768 (Tablet Landscape)
- [ ] 375x667 (Mobile Portrait)
- [ ] 667x375 (Mobile Landscape)

## Functional Testing Checklist

### Dashboard (Requirement 1.1, 1.2, 1.3)
- [ ] Books display in AI-optimized order
- [ ] Book covers, titles, and authors are visible
- [ ] Reading status indicators work correctly
- [ ] Progress bars display accurately
- [ ] Currently Reading section shows in-progress books
- [ ] Up Next section shows not-started books in order
- [ ] Previously Read section shows completed books

### Progress Tracking (Requirement 2.1-2.5)
- [ ] Can update reading status (not started → in progress → completed)
- [ ] Progress percentage updates correctly
- [ ] Page progress tracking works
- [ ] Completion dates are recorded automatically
- [ ] Progress bars reflect current status visually

### Highlights Management (Requirement 3.1-3.6)
- [ ] Can add new highlights with quote text and page numbers
- [ ] Highlights display in chronological order
- [ ] Can edit existing highlights
- [ ] Can delete highlights
- [ ] Search within book highlights works
- [ ] Bulk import of Kindle highlights functions
- [ ] Personal notes can be added to highlights

### Search Functionality (Requirement 3.4)
- [ ] Global search across books and highlights
- [ ] Search results highlight matched terms
- [ ] Filter options work (books vs highlights)
- [ ] Search results are clickable and navigate correctly
- [ ] Empty search results show appropriate message

### User Interface (Requirement 4.1-4.5)
- [ ] Clean, minimalist design throughout
- [ ] Visual elements (covers, progress bars) display correctly
- [ ] Navigation is intuitive and accessible
- [ ] Responsive design works on all screen sizes
- [ ] Loading states are smooth and informative
- [ ] Error messages are user-friendly
- [ ] Form validation provides clear feedback

### Book Detail Pages (Requirement 6.1-6.5)
- [ ] Book metadata displays completely
- [ ] Progress tracking is easily accessible
- [ ] Highlights section is well-organized
- [ ] Personal ratings and reviews can be added
- [ ] Navigation between books is seamless

## Performance Testing Checklist

### Page Load Times
- [ ] Dashboard loads in under 3 seconds
- [ ] Book detail pages load in under 2 seconds
- [ ] Search results appear in under 1 second
- [ ] Image loading doesn't block page rendering

### Responsiveness
- [ ] UI remains responsive during data loading
- [ ] No blocking operations in the main thread
- [ ] Smooth scrolling on all devices
- [ ] Touch interactions work properly on mobile

### Network Conditions
- [ ] Works on slow 3G connections
- [ ] Graceful degradation when offline
- [ ] Proper error handling for network failures
- [ ] Retry mechanisms work correctly

## Accessibility Testing Checklist

### Keyboard Navigation
- [ ] All interactive elements are keyboard accessible
- [ ] Tab order is logical and intuitive
- [ ] Focus indicators are visible
- [ ] Keyboard shortcuts work as expected

### Screen Reader Compatibility
- [ ] All images have appropriate alt text
- [ ] Headings are properly structured (h1, h2, h3)
- [ ] Form labels are associated correctly
- [ ] ARIA attributes are used appropriately

### Visual Accessibility
- [ ] Color contrast meets WCAG AA standards
- [ ] Text is readable at 200% zoom
- [ ] No information conveyed by color alone
- [ ] Focus indicators are clearly visible

## Security Testing Checklist

### Input Validation
- [ ] SQL injection protection on all inputs
- [ ] XSS protection on text fields
- [ ] File upload validation (if applicable)
- [ ] Proper sanitization of user data

### Authentication & Authorization
- [ ] Session management works correctly
- [ ] No sensitive data in client-side storage
- [ ] API endpoints have proper validation
- [ ] Error messages don't leak sensitive information

## Data Integrity Testing Checklist

### Database Operations
- [ ] Book data persists correctly
- [ ] Highlight data is saved accurately
- [ ] Progress updates are atomic
- [ ] No data corruption during concurrent operations

### Import/Export
- [ ] Kindle import preserves all highlight data
- [ ] Export functions maintain data integrity
- [ ] Backup and restore operations work correctly
- [ ] No data loss during system updates

## Browser-Specific Issues to Check

### Chrome
- [ ] Service worker functionality (if implemented)
- [ ] Local storage limits
- [ ] Performance profiling results

### Firefox
- [ ] CSS Grid/Flexbox compatibility
- [ ] Font rendering consistency
- [ ] Privacy settings compatibility

### Safari
- [ ] iOS-specific touch gestures
- [ ] Date/time picker functionality
- [ ] WebKit-specific CSS properties

### Edge
- [ ] Legacy compatibility mode issues
- [ ] Windows-specific font rendering
- [ ] Touch screen support on Windows tablets

## Deployment Testing Checklist

### Docker Container
- [ ] Container builds successfully
- [ ] Health checks pass
- [ ] Volume mounts work correctly
- [ ] Environment variables are properly configured

### Raspberry Pi Specific
- [ ] ARM64 compatibility
- [ ] Memory usage within limits
- [ ] SD card I/O performance
- [ ] Network connectivity via Tailscale

### Production Environment
- [ ] SSL/TLS certificates work
- [ ] Database backups are created
- [ ] Log files are properly rotated
- [ ] Monitoring and alerting function

## Test Data Scenarios

### Empty State
- [ ] New installation with no data
- [ ] Empty search results
- [ ] No highlights for a book

### Large Dataset
- [ ] 100+ books in reading list
- [ ] 1000+ highlights across books
- [ ] Complex search queries

### Edge Cases
- [ ] Books with very long titles
- [ ] Highlights with special characters
- [ ] Unicode text handling
- [ ] Malformed import data

## Sign-off Criteria

- [ ] All critical user journeys work on primary browsers
- [ ] Mobile experience is fully functional
- [ ] Performance meets acceptable thresholds
- [ ] No accessibility blockers
- [ ] Security vulnerabilities addressed
- [ ] Data integrity maintained across all operations