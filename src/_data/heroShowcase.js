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
      id: "dog-run",
      title: "Run",
      image: "/assets/images/collection-images/dog-run.png",
      href: "/shop/?animal=dog&collection=Run",
      accent: "teal"
    },
    {
      id: "cat-catch",
      title: "Catch",
      image: "/assets/images/collection-images/cat-catch.png",
      href: "/shop/?animal=cat&collection=Catch",
      accent: "orange"
    },
    {
      id: "cat-chew",
      title: "Chew",
      image: "/assets/images/collection-images/cat-chew.png",
      href: "/shop/?animal=cat&collection=Chew",
      accent: "navy"
    },
    {
      id: "cat-scratch",
      title: "Scratch",
      image: "/assets/images/collection-images/cat-scratch.png",
      href: "/shop/?animal=cat&collection=Scratch",
      accent: "blue"
    },
    {
      id: "cat-tease",
      title: "Tease",
      image: "/assets/images/collection-images/cat-tease.png",
      href: "/shop/?animal=cat&collection=Tease",
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
