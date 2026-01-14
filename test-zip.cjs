const { PatreonSource } = require("./build/sources/premium/patreon.js");

(async () => {
  const patreon = new PatreonSource();

  // Enable just Kavsoft for testing
  patreon.saveEnabledCreators(["5338573"]);

  console.log("=== Testing Zip Extraction ===\n");

  // This will fetch videos and try to extract zips from Patreon posts
  const patterns = await patreon.fetchPatterns();

  console.log("\n=== Results ===");
  console.log("Total patterns:", patterns.length);

  // Count by type
  const ytPatterns = patterns.filter(p => p.id.startsWith("yt-"));
  const zipPatterns = patterns.filter(p => p.id.startsWith("zip-"));

  console.log("YouTube videos:", ytPatterns.length);
  console.log("Zip extracted files:", zipPatterns.length);

  if (zipPatterns.length > 0) {
    console.log("\n=== Sample Zip Patterns ===");
    zipPatterns.slice(0, 3).forEach(p => {
      console.log("-", p.title);
      console.log("  Topics:", p.topics.join(", ") || "none");
      console.log("  Has code:", p.hasCode);
      console.log();
    });
  }
})();
