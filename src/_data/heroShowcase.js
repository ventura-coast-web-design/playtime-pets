/**
 * Home hero: category collection cards (4 dog + 4 cat) + shop-by-collection bars.
 */
module.exports = async function () {
  const featuredCategories = [
    {
      id: "dog-fetch",
      title: "Fetch",
      image: "/assets/images/collection-images/dog-fetch.png",
      href: "/shop/?animal=dog&collection=Fetch",
      accent: "blue"
    },
    {
      id: "dog-chew",
      title: "Chew",
      image: "/assets/images/collection-images/dog-chew.png",
      href: "/shop/?animal=dog&collection=Chew",
      accent: "yellow"
    },
    {
      id: "dog-plush",
      title: "Plush",
      image: "/assets/images/collection-images/dog-plush.png",
      href: "/shop/?animal=dog&collection=Plush",
      accent: "pink"
    },
    {
      id: "dog-puzzle",
      title: "Puzzle",
      image: "/assets/images/collection-images/dog-puzzle.webp",
      href: "/shop/?animal=dog&collection=Puzzle",
      accent: "teal"
    },
    {
      id: "cat-catnip",
      title: "Catnip",
      image: "/assets/images/collection-images/cat-catnip.webp",
      href: "/shop/?animal=cat&collection=Catnip",
      accent: "orange"
    },
    {
      id: "cat-interactive",
      title: "Interactive",
      image: "/assets/images/collection-images/cat-interactive.webp",
      href: "/shop/?animal=cat&collection=Interactive",
      accent: "navy"
    },
    {
      id: "cat-scratch",
      title: "Scratch",
      image: "/assets/images/collection-images/cat-scratch.webp",
      href: "/shop/?animal=cat&collection=Scratch",
      accent: "blue"
    },
    {
      id: "cat-teaser",
      title: "Teaser",
      image: "/assets/images/collection-images/cat-tease.webp",
      href: "/shop/?animal=cat&collection=Teaser",
      accent: "pink"
    }
  ];

  const collectionBars = [
    { label: "Dog", href: "/shop/?animal=dog" },
    { label: "Cat", href: "/shop/?animal=cat" },
    { label: "Outdoor", href: "/shop/?collection=Outdoor" },
    { label: "Solo Play", href: "/shop/?collection=Solo%20Play" },
    { label: "Indoor", href: "/shop/?collection=Indoor" },
    { label: "Interactive", href: "/shop/?collection=Interactive" }
  ];

  return {
    featuredCategories: featuredCategories,
    collectionBars: collectionBars
  };
};
