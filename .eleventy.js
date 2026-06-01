const path = require("path");
require("dotenv").config();

function getPaginationWindow(currentPage, totalPages) {
  const current = parseInt(currentPage, 10);
  const total = parseInt(totalPages, 10);
  if (!total || total < 1) return [];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const set = new Set([1, total]);
  for (let p = current - 2; p <= current + 2; p++) {
    if (p >= 1 && p <= total) set.add(p);
  }

  const nums = [...set].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < nums.length; i++) {
    if (i > 0 && nums[i] - nums[i - 1] > 1) out.push("ellipsis");
    out.push(nums[i]);
  }
  return out;
}

module.exports = function(eleventyConfig) {
  eleventyConfig.addFilter("paginationWindow", function (currentPage, totalPages) {
    return getPaginationWindow(currentPage, totalPages);
  });

  // Copy CSS to output directory
  eleventyConfig.addPassthroughCopy("src/assets/css");
  
  // Copy other static assets
  eleventyConfig.addPassthroughCopy("src/assets/images");
  eleventyConfig.addPassthroughCopy("src/assets/js");
  
  // Set Liquid as the default template engine
  eleventyConfig.setLiquidOptions({
    root: [path.join(__dirname, "src", "_includes")],
    dynamicPartials: true,
    strictFilters: false,
    strictVariables: false
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      layouts: "_includes/layouts",
      data: "_data"
    },
    templateFormats: ["liquid", "md", "html", "11ty.js"],
    markdownTemplateEngine: "liquid",
    htmlTemplateEngine: "liquid"
  };
};
