# StoryTime Mobile-First Product Specification

## Document Purpose
This document translates the app concept into a build-ready product reference for StoryTime as a mobile-first experience (with the website aligned to the same behavior and features).

## Product Vision
StoryTime is a short-story discovery, reading, and writing platform with:
- TikTok-style story discovery.
- Swipe-based curation into personal shelves.
- Fast reading UX with completion-focused design.
- Social and creator ecosystem features (follow, repost/retweet-style sharing, rankings, competitions).

## Core Principles
- Mobile first: design for phone interaction before desktop.
- Frictionless discovery: stories are instantly browsable and filterable.
- Completion optimized: ranking and recommendations favor completion quality signals.
- Creator growth: new and smaller authors should still receive distribution.
- Reader ownership: users organize saved stories into custom shelves.

## Primary User Roles
- Reader: discovers, reads, saves, rates, and follows authors.
- Author: writes, publishes, and tracks engagement.
- Hybrid user: both reads and writes.
- Platform curator/admin: manages featured lists, competitions, and editorial highlights.

## Information Architecture (Top-Level Tabs)
1. Feed (default discovery experience)
2. Authors
3. Shelves
4. Write (center tab)
5. Profile

Additional content surfaces integrated into Feed and/or standalone pages:
- Personal Feed
- Storytime Algo
- Public Domain
- Suggestions
- Hot
- Featured

## Feed Experience (Primary Screen)

### Header
- Thin horizontal search bar across the top.
- Search supports text and filters.
- Mode filters:
  - Following
  - Feed
  - Public Domain

### Main Card Area (~80% of screen)
- Dominant “book-like” story card containing:
  - Cover image
  - Title
  - Metadata footer:
    - Length
    - Author
    - Genre
    - One-sentence synopsis
    - Views
    - Likes

### List Mode (Website-Like Option on iPhone)
- Feed includes a toggle between:
  - Card mode (default swipe/book-style experience)
  - List mode (website-like browsing experience)
- List mode presents multiple stories in a vertical list with compact cards.
- Each list item includes:
  - Cover thumbnail
  - Title
  - Author
  - Genre
  - Length
  - One-sentence synopsis
  - Views and likes
- List mode supports quick open into the reader and quick save to Shelves.
- Mode preference should persist per user across sessions/devices when possible.

### Gestures on Story Card
- Swipe right:
  - Save story to Shelves (read later).
  - User can choose/create shelf name (playlist-style organization).
- Swipe left:
  - Dismiss story.
  - Story should not appear again to that user.
- Swipe up:
  - Snooze story.
  - Story may reappear later, but not the same day.
- Tap/press cover:
  - Open story reader at page one.

## Reader Experience
- Opens from selected story card.
- Shows reading progress bar indicating completion percentage.
- Reading modes:
  - Page-turn mode (book-like horizontal page swipes).
  - Scroll mode (continuous vertical reading).
- Completion event should be captured when user reaches end of story.

## Shelves
- Save-for-later system using user-created named shelves.
- Analogous to playlists for books/stories.
- Users can:
  - Create shelf
  - Rename shelf
  - Add/remove stories
  - Browse stories by shelf

## Authors Tab
- Ranks authors by viewers:
  - Monthly
  - Yearly
- Supports genre-based categorization.
- Highlights newly released stories from authors.

## Feed Types and Ranking Surfaces

### 1) Personal Feed
- Content from followed users/authors.
- Includes repost/retweet-style shared stories.
- Includes occasional personalized story suggestions.

### 2) StoryTime Algo
- Main algorithmic feed.
- Ranks by completion rate and personalization signals.
- Personalization considers preferred genres and preferred lengths.
- Every uploaded story is eligible.
- Includes a “new story push” mechanism so fresh uploads can get discovery.

### 3) Public Domain
- Dedicated page containing public domain stories.
- Also integrated into broader discovery surfaces.

### 4) Suggestions
- Hand-picked recommendations by the app.
- Window: stories from the past 3 months.
- Refresh cadence: monthly.
- Stories fall off after 3 months.
- Sorted by length.

### 5) Hot
- Top 10 stories by:
  - Length
  - Genre
  - Time window (month and year)
- Rating inputs:
  - Completion rate
  - Like/dislike ratio
  - Viewer volume

### 6) Featured
- Company/editorial hand-picked stories.
- Includes competitions and curated campaigns.

## Write Tab
- Central creation surface for drafting stories.
- Supports author workflow from draft to publish.
- Should be easy to access from the main navigation.

## Profile Tab
- User identity and activity hub:
  - User’s published stories
  - Followers
  - Following
  - Retweets/reposts
  - Shelves

## Key Data Model (Conceptual)
- User
- AuthorProfile
- Story
- StoryPage or StoryContent
- StoryMetrics (views, likes, dislikes, completion rate)
- Shelf
- ShelfItem
- Follow
- Repost/Retweet
- Genre
- FeedImpression
- SwipeAction (right/left/up)
- RecommendationCandidate
- RankingSnapshot (monthly/yearly/genre/length)

## Core Events to Track
- Story impression
- Story open
- Story completion
- Reader mode selected (page vs scroll)
- Swipe right (save), left (dismiss), up (snooze)
- Like/dislike
- Follow/unfollow
- Repost action
- Shelf create/rename/delete
- Story publish

## Moderation and Safety Considerations
- Story reporting flow.
- Basic content policy enforcement.
- Public domain validation for rights-safe labeling.
- Rate limiting and abuse protection for engagement actions.

## Mobile UX Notes
- Keep story card and gesture hit areas thumb-friendly.
- Use immediate gesture feedback (visual direction cues).
- Ensure reader mode toggle is persistent and easy to reach.
- Keep navigation lightweight and consistent across tabs.

## Website Alignment Strategy
- Maintain one product behavior model across web and mobile.
- Implement responsive layouts, but preserve the same core interactions:
  - Swipe-equivalent interactions on web (mouse/keyboard controls and buttons).
  - Identical feed types and ranking logic.
  - Shared account, shelves, profile, and author systems.
- Treat mobile as the reference UX; desktop adapts without changing feature semantics.

## Website Tab Routes (Current Build Target)
- `/feed` : Primary feed with card/list mode, search, mode filters, and quick access to all discovery surfaces.
- `/personal-feed` : Followed/engagement-weighted surface with occasional personalized suggestions.
- `/algo` : Storytime algorithm surface ranked by completion-heavy score and personalized filters.
- `/public-domain` : Dedicated public domain stories page.
- `/suggestions` : Last-3-month curated recommendations sorted by length.
- `/hot` : Top 10 stories with month/year, genre, and length filters.
- `/featured` : Editorial/company hand-picked stories and campaigns.
- `/authors` : Author rankings by month/year with genre filters and new release highlights.
- `/shelves` : Reader-managed save-for-later shelves (playlist-style organization).
- `/write` : Story drafting and publishing flow.
- `/profile/[id]` : User profile with stories plus social/account sections (followers, following, reposts, shelves).

## Suggested Build Phasing
1. Phase 1: Mobile Feed + Gestures + Reader + Shelves (core loop)
2. Phase 2: Authors tab + Personal Feed + Profile core
3. Phase 3: StoryTime Algo + Hot + Suggestions + Public Domain integration
4. Phase 4: Write tab polishing + Featured campaigns + competitions + advanced ranking transparency

## Acceptance Criteria Snapshot
- User can discover stories from feed and open them in reader.
- User can swipe right to save, left to dismiss, up to snooze.
- User can switch between card mode and list mode on iPhone.
- User can organize saved stories into named shelves.
- Reader supports both page-turn and scroll modes.
- Core tabs exist and are navigable.
- Ranking surfaces (Personal, Algo, Hot, Suggestions, Featured, Public Domain) are clearly separated and functional.
- Author and profile views reflect social and publishing activity.

## Open Questions (To Finalize Before Full Build)
- What exact minimum and maximum story length qualifies as “short story”?
- Should dismissed stories be recoverable in settings/history?
- How should reposts affect original author ranking credit?
- What anti-gaming rules govern completion rate quality?
- Should public domain stories be visibly tagged in all feeds?
- What are the exact tie-breakers in Hot rankings?

## Implementation Note
This document is a product specification baseline derived from the provided concept and can be used as a reference while implementing both the mobile app and website parity.
