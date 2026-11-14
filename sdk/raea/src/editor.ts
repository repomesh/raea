// raea/editor (raea's own; Bevy has no timeline editor): docs/timeline.feature TL11b. The timeline the feed edits a film, a scene or a sound on,
// as data. Tracks, clips, keys and markers; every edit an operation with its inverse (apply); a composition's
// sequences read into it (fromSequences) and an operation turned into the edits to write back (seqEdits); a film's
// scenes read into it (fromRender) and its cut read back out as segments (segmentsOf); easings, speed curves, snapping, the
// frame store's keys and what a plugin adds. No React and no DOM: an agent's script, the app's host and a test use
// the same model the app's strip does.
export * from "@raea/timeline";
