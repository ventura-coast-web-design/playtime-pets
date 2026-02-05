const path = require("path");

module.exports = function(eleventyConfig) {
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
    templateFormats: ["liquid", "md", "html"],
    markdownTemplateEngine: "liquid",
    htmlTemplateEngine: "liquid"
  };
};
