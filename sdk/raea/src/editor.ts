// raea/editor (raea's own; Bevy has no timeline editor): docs/timeline.feature TL11b. The timeline the feed edits a film, a scene or a sound on,
// as data. Tracks, clips, keys and markers; every edit an operation with its inverse (apply); a composition's
// sequences read into it (sequenceRows) and the edits written back as SeqEdit; easings, speed curves, snapping, the
// frame store's keys and what a plugin adds. No React and no DOM: an agent's script, the app's host and a test use
// the same model the app's strip does.
export * from "@raea/timeline";
